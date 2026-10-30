import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { CloudCheck, Lock, LogOut, ShieldCheck, X } from 'lucide-react';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DokumentasiModule } from './components/DokumentasiModule';
import { PesertaModule } from './components/PesertaModule';
import { PptkExecutiveModule } from './components/PptkExecutiveModule';
import { ProxyPanitiaModule } from './components/ProxyPanitiaModule';
import { VercelBlueprintModal } from './components/VercelBlueprintModal';
import { VerifikatorSpjModule } from './components/VerifikatorSpjModule';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeDocId,
  signInWithGooglePopup,
  signOutFromGoogle,
  truncateStr,
} from './firebase';
import {
  ActivityConfig,
  AppModule,
  AuditLogEntry,
  DocumentationPhoto,
  DocumentStatus,
  GolonganType,
  InputMode,
  ParticipantRecord,
  PhotoCategory,
  SimKantorState,
  SpeakerRecord,
  SpeakerRole,
  SpprItem,
} from './types/simkantor';
import { createInitialSimKantorState } from './utils/initialSeedData';
import { PrintableDocumentPayload } from './utils/pdfGenerator';
import {
  calculateHonorariumPPh21,
  createDocumentationSvg,
} from './utils/spjCalculators';

const STORAGE_KEY = 'simkantor_hybrid_state_v1';
const COMMITTEE_AUTH_KEY = 'simkantor_committee_unlocked_v1';
const DEFAULT_COMMITTEE_PIN = '2025';
const BOOTSTRAPPED_ADMIN_EMAIL = 'brcloud070783@gmail.com';

// Helper untuk membersihkan field undefined sebelum dikirim ke Firestore
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export default function App() {
  const [state, setState] = useState<SimKantorState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as SimKantorState;
      }
    } catch {
      // Abaikan
    }
    return createInitialSimKantorState();
  });

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [ParticipantOwnerMap, setParticipantOwnerMap] = useState<Record<string, string>>(
    {}
  );

  const [isCommitteeUnlocked, setIsCommitteeUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(COMMITTEE_AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeModule, setActiveModule] = useState<AppModule>(AppModule.PESERTA);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<PrintableDocumentPayload | null>(null);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState<boolean>(false);

  // 1. Pantau status autentikasi Firebase Google
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
      if (user) {
        setSelectedParticipantId((prev) => prev || user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listener Real-Time Cloud Firestore (Aktif saat user sudah login Google)
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    const unsubscribers: Array<() => void> = [];

    // A. Listener Konfigurasi Kegiatan (/activityConfigs/main)
    const configRef = doc(db, 'activityConfigs', 'main');
    unsubscribers.push(
      onSnapshot(
        configRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ActivityConfig;
            setState((prev) => ({
              ...prev,
              config: {
                ...prev.config,
                instansiPenyelenggara: data.instansiPenyelenggara,
                satuanKerja: data.satuanKerja,
                namaKegiatan: data.namaKegiatan,
                lokasiKegiatan: data.lokasiKegiatan,
                tanggalMulai: data.tanggalMulai,
                tanggalSelesai: data.tanggalSelesai,
                jumlahHariKegiatan: data.jumlahHariKegiatan,
                nomorDpa: data.nomorDpa,
                tahunAnggaran: data.tahunAnggaran,
                kodeMak: data.kodeMak,
                paguDpaTotal: data.paguDpaTotal,
                paguUangHarian: data.paguUangHarian,
                paguTransportPeserta: data.paguTransportPeserta,
                paguHonorNarasumber: data.paguHonorNarasumber,
                paguKonsumsiOperasional: data.paguKonsumsiOperasional,
                realisasiKonsumsiOperasional: data.realisasiKonsumsiOperasional,
                tarifUangHarianSbm: data.tarifUangHarianSbm,
                plafonTransportLokal: data.plafonTransportLokal,
                namaPptk: data.namaPptk,
                nipPptk: data.nipPptk,
                namaBendahara: data.namaBendahara,
                nipBendahara: data.nipBendahara,
              },
            }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'activityConfigs/main')
      )
    );

    // B. Listener Galeri Foto Kegiatan (/photos dengan visibility == PUBLIC)
    const photosQuery = query(
      collection(db, 'photos'),
      where('visibility', '==', 'PUBLIC')
    );
    unsubscribers.push(
      onSnapshot(
        photosQuery,
        (snap) => {
          if (!snap.empty) {
            const loadedPhotos = snap.docs.map(
              (d) => d.data() as unknown as DocumentationPhoto
            );
            setState((prev) => ({ ...prev, photos: loadedPhotos }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'photos')
      )
    );

    const isVerifiedAdminUser =
      firebaseUser.emailVerified &&
      (firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL ||
        isCommitteeUnlocked);

    // C. Listener Data Peserta:
    // - Jika Panitia/Admin: Sinkronisasi seluruh peserta kegiatan
    // - Jika Peserta: Hanya sinkronisasi dokumen miliknya sendiri (PII Isolation)
    if (isVerifiedAdminUser) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'participants'),
          (snap) => {
            const ownerMap: Record<string, string> = {};
            const loadedParticipants: ParticipantRecord[] = snap.docs.map((d) => {
              const raw = d.data() as ParticipantRecord & { ownerUid?: string };
              ownerMap[raw.id] = raw.ownerUid || firebaseUser.uid;
              return raw;
            });
            setParticipantOwnerMap(ownerMap);
            setState((prev) => ({
              ...prev,
              participants: loadedParticipants,
            }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'participants')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'speakers'),
          (snap) => {
            if (!snap.empty) {
              const loadedSpeakers = snap.docs.map(
                (d) => d.data() as unknown as SpeakerRecord
              );
              setState((prev) => ({ ...prev, speakers: loadedSpeakers }));
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'speakers')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'auditLogs'),
          (snap) => {
            if (!snap.empty) {
              const loadedLogs = snap.docs.map(
                (d) => d.data() as unknown as AuditLogEntry
              );
              setState((prev) => ({ ...prev, auditLogs: loadedLogs }));
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
        )
      );
    } else {
      // Peserta hanya mendengarkan dokumen miliknya sendiri
      const ownQuery = query(
        collection(db, 'participants'),
        where('ownerUid', '==', firebaseUser.uid)
      );
      unsubscribers.push(
        onSnapshot(
          ownQuery,
          (snap) => {
            if (!snap.empty) {
              const ownDocs = snap.docs.map((d) => {
                const raw = d.data() as ParticipantRecord & { ownerUid?: string };
                return raw;
              });
              setState((prev) => {
                const others = prev.participants.filter(
                  (item) => !ownDocs.some((o) => o.id === item.id)
                );
                return {
                  ...prev,
                  participants: [...ownDocs, ...others],
                };
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'participants')
        )
      );
    }

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [isAuthReady, firebaseUser, isCommitteeUnlocked]);

  const updateAndPersistState = (updater: (prev: SimKantorState) => SimKantorState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Abaikan
      }
      return next;
    });
  };

  // Fungsi Simpan Peserta ke Cloud Firestore sesuai skema firebase-blueprint.json
  const persistParticipantToFirestore = async (
    p: ParticipantRecord,
    explicitOwnerUid?: string
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const docId = sanitizeDocId(p.id);
    const ownerUid =
      explicitOwnerUid || ParticipantOwnerMap[docId] || currentUser.uid;

    const payload: Record<string, unknown> = {
      id: docId,
      ownerUid: sanitizeDocId(ownerUid),
      nama: truncateStr(p.nama, 200, 'Peserta'),
      email: truncateStr(p.email, 200, currentUser.email || 'peserta@gmail.com'),
      nip: truncateStr(p.nip, 50, '-'),
      pangkatGolongan: truncateStr(p.pangkatGolongan, 50, GolonganType.GOL_III),
      jabatan: truncateStr(p.jabatan, 150, 'Peserta Kegiatan'),
      instansi: truncateStr(p.instansi, 200, 'Instansi Peserta'),
      kabupatenKota: truncateStr(p.kabupatenKota, 150, 'Kabupaten/Kota'),
      noHp: truncateStr(p.noHp, 40, '-'),
      namaBank: truncateStr(p.namaBank, 60, 'BRI'),
      noRekening: truncateStr(p.noRekening, 80, '-'),
      statusBerkas: p.statusBerkas,
      inputMode: p.inputMode,
      driveFolderId: truncateStr(p.driveFolderId, 150, `DRV-${docId}`),
      driveFolderName: truncateStr(p.driveFolderName, 250, `${p.nip} - ${p.nama}`),
      driveFolderUrl: truncateStr(
        p.driveFolderUrl,
        400,
        `https://drive.google.com/drive/folders/${docId}`
      ),
      attendance: stripUndefined(p.attendance.slice(0, 14)),
      documents: stripUndefined(p.documents || {}),
      spprItems: stripUndefined((p.spprItems || []).slice(0, 20)),
      verification: stripUndefined(p.verification),
      updatedAt: truncateStr(p.updatedAt, 60, new Date().toLocaleTimeString('id-ID')),
      serverUpdatedAt: serverTimestamp(),
    };

    if (p.proxyOfficerName) {
      payload.proxyOfficerName = truncateStr(p.proxyOfficerName, 150);
    }
    if (p.proxyReason) {
      payload.proxyReason = truncateStr(p.proxyReason, 300);
    }

    try {
      await setDoc(doc(db, 'participants', docId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `participants/${docId}`);
    }
  };

  const persistAuditLogToFirestore = async (log: AuditLogEntry) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const logId = sanitizeDocId(log.id);
    try {
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        actorUid: sanitizeDocId(currentUser.uid),
        timestamp: truncateStr(log.timestamp, 60),
        actorName: truncateStr(log.actorName, 150),
        actorRole: log.actorRole,
        actionType: truncateStr(log.actionType, 100),
        targetName: truncateStr(log.targetName, 200),
        details: truncateStr(log.details, 600),
        isFlaggedProxy: Boolean(log.isFlaggedProxy),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
    }
  };

  const handleUnlockCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() !== DEFAULT_COMMITTEE_PIN) {
      setPinError('Kode PIN Panitia tidak sesuai. Gunakan PIN bawaan: 2025');
      return;
    }

    try {
      let activeUser = auth.currentUser;
      if (!activeUser) {
        const result = await signInWithGooglePopup();
        activeUser = result.user;
      }

      if (activeUser && activeUser.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
        const adminId = sanitizeDocId(activeUser.uid);
        try {
          await setDoc(doc(db, 'admins', adminId), {
            uid: adminId,
            email: truncateStr(activeUser.email, 200, 'panitia@gmail.com'),
            pinCode: DEFAULT_COMMITTEE_PIN,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `admins/${adminId}`);
        }
      }

      setIsCommitteeUnlocked(true);
      setActiveModule(AppModule.VERIFIKATOR_SPJ);
      setShowPinModal(false);
      setPinInput('');
      setPinError(null);
      try {
        sessionStorage.setItem(COMMITTEE_AUTH_KEY, 'true');
      } catch {
        // ignore
      }
    } catch (err) {
      setPinError(
        err instanceof Error
          ? err.message
          : 'Gagal memverifikasi akun Google Panitia.'
      );
    }
  };

  const handleLockCommittee = () => {
    setIsCommitteeUnlocked(false);
    setActiveModule(AppModule.PESERTA);
    try {
      sessionStorage.removeItem(COMMITTEE_AUTH_KEY);
    } catch {
      // ignore
    }
  };

  const handleResetOfficialMode = async () => {
    const oldParticipants = [...state.participants];
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      next.participants = [];
      next.auditLogs = [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 10) + ' WIB',
          actorName: 'PPTK / Admin Panitia',
          actorRole: 'PPTK',
          actionType: 'INIT_KEGIATAN_RESMI',
          targetName: next.config.namaKegiatan,
          details:
            'Data contoh telah dibersihkan. Sistem siap menerima registrasi dan berkas peserta resmi.',
          isFlaggedProxy: false,
        },
      ];
      return next;
    });

    if (auth.currentUser) {
      for (const p of oldParticipants) {
        try {
          await deleteDoc(doc(db, 'participants', sanitizeDocId(p.id)));
        } catch {
          // ignore if not in Firestore yet
        }
      }
    }

    try {
      localStorage.removeItem('simkantor_active_peserta_id_v2');
    } catch {
      // ignore
    }
  };

  const handleRestoreDemoData = async () => {
    const demo = createInitialSimKantorState();
    setState(demo);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
    } catch {
      // ignore
    }
    if (auth.currentUser) {
      for (const p of demo.participants) {
        await persistParticipantToFirestore(p, auth.currentUser.uid);
      }
    }
  };

  const handleCheckIn = async (
    participantId: string,
    dayIndex: number,
    isProxy = false,
    proxyOfficerName?: string
  ) => {
    const checkInTime =
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB';
    const tanggal = new Date().toISOString().slice(0, 10);

    let updatedParticipant: ParticipantRecord | undefined;
    let newLog: AuditLogEntry | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === participantId);
      if (!p) return prev;
      if (p.attendance.some((a) => a.dayIndex === dayIndex)) return prev;

      p.attendance.push({
        dayIndex,
        tanggal,
        checkInTime,
        lokasi: next.config.lokasiKegiatan,
        koordinat: '-6.1538, 106.8499',
        recordedBy: isProxy
          ? `PROXY: ${proxyOfficerName || 'Petugas Helpdesk'}`
          : 'Peserta Mandiri (Google Auth)',
        isProxy,
      });

      p.verification.hariDisetujui = p.attendance.length;
      p.verification.totalUangHarian =
        p.verification.hariDisetujui * p.verification.tarifUangHarian;
      p.verification.totalDiterima =
        p.verification.totalUangHarian + p.verification.transportDisetujui;
      p.updatedAt = checkInTime;

      updatedParticipant = structuredClone(p);

      newLog = {
        id: `aud-${Date.now()}`,
        timestamp: `${tanggal} ${checkInTime}`,
        actorName: isProxy ? proxyOfficerName || 'Panitia Helpdesk' : p.nama,
        actorRole: isProxy ? 'PANITIA_PROXY' : 'PESERTA',
        actionType: `CHECKIN_PRESENSI_HARI_${dayIndex}`,
        targetName: `${p.nama} (${p.nip})`,
        details: `Check-in presensi Hari ke-${dayIndex} pada pukul ${checkInTime}. Total hadir: ${p.attendance.length} hari.`,
        isFlaggedProxy: isProxy,
      };
      next.auditLogs.unshift(newLog);
      return next;
    });

    if (updatedParticipant) {
      await persistParticipantToFirestore(updatedParticipant);
    }
    if (newLog) {
      await persistAuditLogToFirestore(newLog);
    }
  };

  const handleSaveBiodata = async (
    payload: Partial<ParticipantRecord>
  ): Promise<string | undefined> => {
    let savedParticipant: ParticipantRecord | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      let p = next.participants.find(
        (item) =>
          item.id === payload.id ||
          (payload.nip && item.nip === payload.nip) ||
          (payload.email && item.email.toLowerCase() === payload.email.toLowerCase())
      );
      const isProxy = payload.inputMode === InputMode.PROXY_PANITIA;

      if (!p) {
        const idx = next.participants.length + 1;
        const cleanNip = payload.nip || `19900101202012100${idx}`;
        const rawNewId =
          (!isProxy && auth.currentUser?.uid) ||
          payload.id ||
          `pst-${Date.now().toString().slice(-6)}`;
        const newId = sanitizeDocId(rawNewId);

        p = {
          id: newId,
          nama: payload.nama || 'Peserta Baru',
          email:
            payload.email ||
            auth.currentUser?.email ||
            `${(payload.nama || 'peserta').toLowerCase().replace(/[^a-z]/g, '.')}@gmail.com`,
          nip: cleanNip,
          pangkatGolongan: payload.pangkatGolongan || GolonganType.GOL_III,
          jabatan: payload.jabatan || 'Peserta Utusan',
          instansi: payload.instansi || 'Instansi Daerah',
          kabupatenKota: payload.kabupatenKota || 'Kabupaten/Kota',
          noHp: payload.noHp || '-',
          namaBank: payload.namaBank || 'BRI',
          noRekening: payload.noRekening || '-',
          statusBerkas: DocumentStatus.BELUM_LENGKAP,
          inputMode: isProxy ? InputMode.PROXY_PANITIA : InputMode.MANDIRI,
          proxyOfficerName: isProxy ? payload.proxyOfficerName : undefined,
          proxyReason: isProxy ? payload.proxyReason : undefined,
          driveFolderId: `DRV-FOLDER-${cleanNip}`,
          driveFolderName: `${cleanNip} - ${payload.nama || 'Peserta'}`,
          driveFolderUrl: `https://drive.google.com/drive/folders/PANITIA_${cleanNip}`,
          attendance: [
            {
              dayIndex: 1,
              tanggal: new Date().toISOString().slice(0, 10),
              checkInTime: new Date().toLocaleTimeString('id-ID') + ' WIB',
              lokasi: next.config.lokasiKegiatan,
              koordinat: '-6.1538, 106.8499',
              recordedBy: isProxy
                ? `PROXY: ${payload.proxyOfficerName}`
                : 'Peserta Mandiri (Google Auth)',
              isProxy,
            },
          ],
          documents: {},
          spprItems: [],
          verification: {
            hariDisetujui: 1,
            tarifUangHarian: next.config.tarifUangHarianSbm,
            totalUangHarian: next.config.tarifUangHarianSbm,
            transportDisetujui: 0,
            gunakanSppr: false,
            totalDiterima: next.config.tarifUangHarianSbm,
            statusBayar: 'BELUM_DIBAYAR',
            noKuitansi: `KUI/SPJ/${next.config.tahunAnggaran}/${String(idx).padStart(3, '0')}`,
            catatanVerifikator: 'Biodata terdaftar.',
          },
          updatedAt: new Date().toLocaleTimeString('id-ID') + ' WIB',
        };
        next.participants.unshift(p);
      } else {
        p.nama = payload.nama ?? p.nama;
        p.email = payload.email ?? p.email;
        p.nip = payload.nip ?? p.nip;
        p.pangkatGolongan = payload.pangkatGolongan ?? p.pangkatGolongan;
        p.jabatan = payload.jabatan ?? p.jabatan;
        p.instansi = payload.instansi ?? p.instansi;
        p.kabupatenKota = payload.kabupatenKota ?? p.kabupatenKota;
        p.noHp = payload.noHp ?? p.noHp;
        p.namaBank = payload.namaBank ?? p.namaBank;
        p.noRekening = payload.noRekening ?? p.noRekening;
        p.driveFolderName = `${p.nip} - ${p.nama}`;
        p.updatedAt = new Date().toLocaleTimeString('id-ID') + ' WIB';
      }

      savedParticipant = structuredClone(p);
      return next;
    });

    if (savedParticipant) {
      await persistParticipantToFirestore(savedParticipant);
      return savedParticipant.id;
    }

    return payload.id;
  };

  const handleUploadDocument = async (payload: {
    participantId: string;
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport' | 'buktiBayarSusulan';
    dataUrl: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    uploadedBy: string;
    isProxy: boolean;
    isLateFinanceUpload?: boolean;
    auditNote?: string;
    nominalTransport?: number;
  }) => {
    let updatedParticipant: ParticipantRecord | undefined;
    let newLog: AuditLogEntry | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === payload.participantId);
      if (!p) return prev;

      const prefixMap = {
        suratTugas: 'SURAT_TUGAS',
        sppdVisum: 'SPPD_VISUM',
        buktiTransport: 'TIKET_TRANSPORT',
        buktiBayarSusulan: 'BUKTI_SUSULAN_KEUANGAN',
      };
      const prefix = prefixMap[payload.docType];
      const cleanName = p.nama.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${
        payload.isProxy ? 'PROXY_' : ''
      }${prefix}_${p.nip}_${cleanName}.jpg`;
      const driveFileId = `DRV-${prefix}-${Date.now().toString().slice(-5)}`;

      const uploadedDoc = {
        fileName,
        uploadedAt:
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB',
        uploadedBy: payload.uploadedBy,
        isProxy: payload.isProxy,
        isLateFinanceUpload: payload.isLateFinanceUpload,
        auditNote: payload.auditNote,
        originalSizeKB: payload.originalSizeKB,
        compressedSizeKB: payload.compressedSizeKB,
        driveFileId,
        driveViewUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
        dataUrl: payload.dataUrl,
      };

      if (payload.docType === 'suratTugas') p.documents.suratTugas = uploadedDoc;
      if (payload.docType === 'sppdVisum') p.documents.sppdVisum = uploadedDoc;
      if (payload.docType === 'buktiTransport') {
        p.documents.buktiTransport = uploadedDoc;
        if (payload.nominalTransport && payload.nominalTransport > 0) {
          p.verification.transportDisetujui = payload.nominalTransport;
          p.verification.gunakanSppr = false;
          p.verification.totalDiterima =
            p.verification.totalUangHarian + p.verification.transportDisetujui;
        }
      }
      if (payload.docType === 'buktiBayarSusulan') {
        p.documents.buktiBayarSusulan = uploadedDoc;
      }

      const hasSt = Boolean(p.documents.suratTugas);
      const hasSppd = Boolean(p.documents.sppdVisum);
      const hasTr = Boolean(
        p.documents.buktiTransport ||
          p.documents.spprGenerated ||
          p.documents.buktiBayarSusulan
      );
      if (hasSt && hasSppd && hasTr && p.statusBerkas === DocumentStatus.BELUM_LENGKAP) {
        p.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
      }

      p.updatedAt = new Date().toLocaleTimeString('id-ID') + ' WIB';
      updatedParticipant = structuredClone(p);

      const createdLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().slice(0, 10) + ' ' + p.updatedAt,
        actorName: payload.uploadedBy,
        actorRole: payload.isLateFinanceUpload
          ? 'VERIFIKATOR_SPJ'
          : payload.isProxy
          ? 'PANITIA_PROXY'
          : 'PESERTA',
        actionType: `UPLOAD_${prefix}`,
        targetName: `${p.nama} (${p.nip})`,
        details: `Unggah berkas ${fileName} (${payload.compressedSizeKB} KB).`,
        isFlaggedProxy: payload.isProxy || Boolean(payload.isLateFinanceUpload),
      };
      newLog = createdLog;
      next.auditLogs.unshift(createdLog);

      return next;
    });

    if (updatedParticipant) {
      await persistParticipantToFirestore(updatedParticipant);
    }
    if (newLog) {
      await persistAuditLogToFirestore(newLog);
    }
  };

  const handleSaveSppr = async (participantId: string, items: SpprItem[]) => {
    let updatedParticipant: ParticipantRecord | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === participantId);
      if (!p) return prev;

      p.spprItems = items;
      const totalSppr = items.reduce((s, i) => s + (Number(i.nominal) || 0), 0);
      const nomorSppr = `SPPR/${next.config.tahunAnggaran}/${p.id.toUpperCase()}`;

      p.documents.spprGenerated = {
        nomorSppr,
        generatedAt:
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB',
        totalNominal: totalSppr,
        items,
        driveFileId: `DRV-SPPR-${p.nip}`,
      };

      p.verification.transportDisetujui = totalSppr;
      p.verification.gunakanSppr = true;
      p.verification.totalDiterima = p.verification.totalUangHarian + totalSppr;

      if (
        p.documents.suratTugas &&
        p.documents.sppdVisum &&
        p.statusBerkas === DocumentStatus.BELUM_LENGKAP
      ) {
        p.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
      }

      p.updatedAt = new Date().toLocaleTimeString('id-ID') + ' WIB';
      updatedParticipant = structuredClone(p);
      return next;
    });

    if (updatedParticipant) {
      await persistParticipantToFirestore(updatedParticipant);
    }
  };

  const handleVerifyParticipant = async (payload: {
    participantId: string;
    hariDisetujui: number;
    tarifUangHarian: number;
    transportDisetujui: number;
    gunakanSppr: boolean;
    statusBerkas: DocumentStatus;
    statusBayar: 'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR';
    catatanVerifikator: string;
    verifikatorName: string;
  }) => {
    let updatedParticipant: ParticipantRecord | undefined;
    let newLog: AuditLogEntry | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === payload.participantId);
      if (!p) return prev;

      const totalUh = payload.hariDisetujui * payload.tarifUangHarian;
      const totalAll = totalUh + payload.transportDisetujui;

      p.statusBerkas = payload.statusBerkas;
      p.verification = {
        ...p.verification,
        hariDisetujui: payload.hariDisetujui,
        tarifUangHarian: payload.tarifUangHarian,
        totalUangHarian: totalUh,
        transportDisetujui: payload.transportDisetujui,
        gunakanSppr: payload.gunakanSppr,
        totalDiterima: totalAll,
        statusBayar: payload.statusBayar,
        catatanVerifikator: payload.catatanVerifikator,
        verifikatorName: payload.verifikatorName,
      };
      p.updatedAt = new Date().toLocaleTimeString('id-ID') + ' WIB';
      updatedParticipant = structuredClone(p);

      const createdLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().slice(0, 10) + ' ' + p.updatedAt,
        actorName: payload.verifikatorName,
        actorRole: 'VERIFIKATOR_SPJ',
        actionType: `VERIFIKASI_SPJ_${payload.statusBerkas}`,
        targetName: `${p.nama} (${p.nip})`,
        details: `Disetujui ${payload.hariDisetujui} hari. Total diterima: Rp ${totalAll.toLocaleString('id-ID')}.`,
        isFlaggedProxy: false,
      };
      newLog = createdLog;
      next.auditLogs.unshift(createdLog);
      return next;
    });

    if (updatedParticipant) {
      await persistParticipantToFirestore(updatedParticipant);
    }
    if (newLog) {
      await persistAuditLogToFirestore(newLog);
    }
  };

  const handleUpsertSpeaker = async (payload: Partial<SpeakerRecord>) => {
    let savedSpeaker: SpeakerRecord | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const calc = calculateHonorariumPPh21(
        Number(payload.jumlahJP) || 2,
        Number(payload.tarifPerJP) || 900000,
        (payload.golongan as GolonganType) || GolonganType.GOL_IV,
        Boolean(payload.hasNpwp)
      );

      const existing = next.speakers.find((s) => s.id === payload.id);
      if (existing) {
        existing.nama = payload.nama || existing.nama;
        existing.peran = payload.peran || existing.peran;
        existing.instansi = payload.instansi || existing.instansi;
        existing.golongan = payload.golongan || existing.golongan;
        existing.npwp = payload.npwp || existing.npwp;
        existing.namaBank = payload.namaBank || existing.namaBank;
        existing.noRekening = payload.noRekening || existing.noRekening;
        existing.materiJudul = payload.materiJudul || existing.materiJudul;
        existing.jumlahJP = Number(payload.jumlahJP) || existing.jumlahJP;
        existing.tarifPerJP = Number(payload.tarifPerJP) || existing.tarifPerJP;
        existing.bruto = calc.bruto;
        existing.tarifPph21Persen = calc.tarifPph21Persen;
        existing.potonganPph21 = calc.potonganPph21;
        existing.netto = calc.netto;
        savedSpeaker = structuredClone(existing);
      } else {
        const idx = next.speakers.length + 1;
        const created: SpeakerRecord = {
          id: `spk-${Date.now().toString().slice(-5)}`,
          nama: payload.nama || 'Narasumber',
          peran: payload.peran || SpeakerRole.NARASUMBER,
          instansi: payload.instansi || 'Instansi',
          golongan: payload.golongan || GolonganType.GOL_IV,
          npwp: payload.npwp || '-',
          hasNpwp: Boolean(payload.hasNpwp),
          namaBank: payload.namaBank || 'BNI',
          noRekening: payload.noRekening || '-',
          materiJudul: payload.materiJudul || 'Materi Kegiatan',
          jumlahJP: Number(payload.jumlahJP) || 2,
          tarifPerJP: Number(payload.tarifPerJP) || 900000,
          ...calc,
          noKuitansi: `KUI/HONOR/${next.config.tahunAnggaran}/00${idx}`,
          statusBayar: 'TERVERIFIKASI',
          tanggalKegiatan: new Date().toISOString().slice(0, 10),
        };
        next.speakers.push(created);
        savedSpeaker = structuredClone(created);
      }
      return next;
    });

    if (savedSpeaker && auth.currentUser) {
      const spkId = sanitizeDocId(savedSpeaker.id);
      try {
        await setDoc(doc(db, 'speakers', spkId), {
          id: spkId,
          nama: truncateStr(savedSpeaker.nama, 200),
          peran: truncateStr(savedSpeaker.peran, 60),
          instansi: truncateStr(savedSpeaker.instansi, 200),
          golongan: truncateStr(savedSpeaker.golongan, 40),
          npwp: truncateStr(savedSpeaker.npwp, 60),
          hasNpwp: Boolean(savedSpeaker.hasNpwp),
          namaBank: truncateStr(savedSpeaker.namaBank, 60),
          noRekening: truncateStr(savedSpeaker.noRekening, 80),
          materiJudul: truncateStr(savedSpeaker.materiJudul, 300),
          jumlahJP: Number(savedSpeaker.jumlahJP) || 1,
          tarifPerJP: Number(savedSpeaker.tarifPerJP) || 0,
          bruto: Number(savedSpeaker.bruto) || 0,
          tarifPph21Persen: Number(savedSpeaker.tarifPph21Persen) || 0,
          potonganPph21: Number(savedSpeaker.potonganPph21) || 0,
          netto: Number(savedSpeaker.netto) || 0,
          noKuitansi: truncateStr(savedSpeaker.noKuitansi, 100),
          statusBayar: truncateStr(savedSpeaker.statusBayar, 40),
          tanggalKegiatan: truncateStr(savedSpeaker.tanggalKegiatan, 40),
          updatedByUid: sanitizeDocId(auth.currentUser.uid),
          serverUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `speakers/${spkId}`);
      }
    }
  };

  const handleUploadPhoto = async (payload: {
    kategori: PhotoCategory;
    judul: string;
    caption: string;
    hariKe: number;
    uploader: string;
    imageUrl?: string;
    originalSizeKB?: number;
    compressedSizeKB?: number;
  }) => {
    let createdPhoto: DocumentationPhoto | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const newIndex = next.photos.length + 1;
      const tanggal = new Date().toISOString().slice(0, 10);
      const photoObj: DocumentationPhoto = {
        id: `dok-${Date.now().toString().slice(-6)}`,
        kategori: payload.kategori,
        judul: payload.judul,
        caption: payload.caption,
        hariKe: payload.hariKe,
        tanggal,
        timestamp: `${tanggal} WIB`,
        uploader: payload.uploader,
        driveFileId: `DRV-FOTO-0${newIndex}`,
        originalSizeKB: payload.originalSizeKB || 3200,
        compressedSizeKB: payload.compressedSizeKB || 260,
        imageUrl:
          payload.imageUrl ||
          createDocumentationSvg({
            kategori: payload.kategori,
            judul: payload.judul,
            hariKe: payload.hariKe,
            tanggal,
            themeColor: '#1E3A8A',
          }),
      };
      next.photos.unshift(photoObj);
      createdPhoto = structuredClone(photoObj);
      return next;
    });

    if (createdPhoto && auth.currentUser) {
      const photoId = sanitizeDocId(createdPhoto.id);
      try {
        await setDoc(doc(db, 'photos', photoId), {
          id: photoId,
          kategori: truncateStr(createdPhoto.kategori, 100),
          judul: truncateStr(createdPhoto.judul, 200),
          caption: truncateStr(createdPhoto.caption, 500),
          hariKe: Number(createdPhoto.hariKe) || 1,
          tanggal: truncateStr(createdPhoto.tanggal, 40),
          timestamp: truncateStr(createdPhoto.timestamp, 60),
          uploader: truncateStr(createdPhoto.uploader, 150),
          driveFileId: truncateStr(createdPhoto.driveFileId, 150),
          originalSizeKB: Number(createdPhoto.originalSizeKB) || 0,
          compressedSizeKB: Number(createdPhoto.compressedSizeKB) || 0,
          imageUrl: truncateStr(createdPhoto.imageUrl, 700000),
          visibility: 'PUBLIC',
          updatedByUid: sanitizeDocId(auth.currentUser.uid),
          serverUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `photos/${photoId}`);
      }
    }
  };

  const handleUpdateConfig = async (newConfig: Partial<ActivityConfig>) => {
    let mergedConfig: ActivityConfig | undefined;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const oldSbm = next.config.tarifUangHarianSbm;
      next.config = { ...next.config, ...newConfig };
      mergedConfig = structuredClone(next.config);

      if (
        newConfig.tarifUangHarianSbm &&
        Number(newConfig.tarifUangHarianSbm) !== oldSbm
      ) {
        const updatedTarif = Number(newConfig.tarifUangHarianSbm);
        next.participants.forEach((p) => {
          p.verification.tarifUangHarian = updatedTarif;
          p.verification.totalUangHarian = p.verification.hariDisetujui * updatedTarif;
          p.verification.totalDiterima =
            p.verification.totalUangHarian + p.verification.transportDisetujui;
        });
      }
      return next;
    });

    if (mergedConfig && auth.currentUser) {
      try {
        await setDoc(doc(db, 'activityConfigs', 'main'), {
          instansiPenyelenggara: truncateStr(mergedConfig.instansiPenyelenggara, 200),
          satuanKerja: truncateStr(mergedConfig.satuanKerja, 200),
          namaKegiatan: truncateStr(mergedConfig.namaKegiatan, 300),
          lokasiKegiatan: truncateStr(mergedConfig.lokasiKegiatan, 200),
          tanggalMulai: truncateStr(mergedConfig.tanggalMulai, 30),
          tanggalSelesai: truncateStr(mergedConfig.tanggalSelesai, 30),
          jumlahHariKegiatan: Number(mergedConfig.jumlahHariKegiatan) || 3,
          nomorDpa: truncateStr(mergedConfig.nomorDpa, 120),
          tahunAnggaran: Number(mergedConfig.tahunAnggaran) || 2025,
          kodeMak: truncateStr(mergedConfig.kodeMak, 120),
          paguDpaTotal: Number(mergedConfig.paguDpaTotal) || 0,
          paguUangHarian: Number(mergedConfig.paguUangHarian) || 0,
          paguTransportPeserta: Number(mergedConfig.paguTransportPeserta) || 0,
          paguHonorNarasumber: Number(mergedConfig.paguHonorNarasumber) || 0,
          paguKonsumsiOperasional: Number(mergedConfig.paguKonsumsiOperasional) || 0,
          realisasiKonsumsiOperasional:
            Number(mergedConfig.realisasiKonsumsiOperasional) || 0,
          tarifUangHarianSbm: Number(mergedConfig.tarifUangHarianSbm) || 0,
          plafonTransportLokal: Number(mergedConfig.plafonTransportLokal) || 0,
          namaPptk: truncateStr(mergedConfig.namaPptk, 150),
          nipPptk: truncateStr(mergedConfig.nipPptk, 50),
          namaBendahara: truncateStr(mergedConfig.namaBendahara, 150),
          nipBendahara: truncateStr(mergedConfig.nipBendahara, 50),
          updatedByUid: sanitizeDocId(auth.currentUser.uid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'activityConfigs/main');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (1 Row, 3 Zones, gap-8)
      ====================================================================== */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule(AppModule.PESERTA);
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          SIM-KANTOR
        </a>

        {/* Zone 2: Navigation Links */}
        {isCommitteeUnlocked ? (
          <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600">
            {[
              { id: AppModule.VERIFIKATOR_SPJ, label: '1. Verifikator SPJ' },
              { id: AppModule.PROXY_PANITIA, label: '2. Helpdesk Proxy' },
              { id: AppModule.DOKUMENTASI, label: '3. Dokumentasi' },
              { id: AppModule.PPTK_EXECUTIVE, label: '4. PPTK & Pengaturan' },
              { id: AppModule.PESERTA, label: 'Lihat Portal Peserta' },
            ].map((nav) => {
              const isActive = activeModule === nav.id;
              return (
                <a
                  key={nav.id}
                  href={`#${nav.id.toLowerCase()}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveModule(nav.id);
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-b-2 border-blue-700 font-semibold text-slate-900'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {nav.label}
                </a>
              );
            })}
          </nav>
        ) : (
          <div className="truncate text-xs font-medium text-slate-600">
            Portal Resmi Peserta Kegiatan · {state.config.instansiPenyelenggara}
          </div>
        )}

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {isCommitteeUnlocked ? (
            <button
              type="button"
              onClick={handleLockCommittee}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-600" />
              <span>Keluar Mode Panitia</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowPinModal(true);
                setPinError(null);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>Login Panitia / Verifikator</span>
            </button>
          )}
        </div>
      </header>

      {/* Subbar Informasi Kegiatan & Status Cloud Firebase */}
      <div className="border-b border-slate-200 bg-slate-900 px-6 py-2 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">
              {state.config.instansiPenyelenggara}
            </span>
            <span aria-hidden="true">·</span>
            <span>{state.config.namaKegiatan}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-300">
            <CloudCheck className="h-3.5 w-3.5" />
            <span>
              {firebaseUser
                ? `Cloud Firebase Aktif (${firebaseUser.email})`
                : 'Cloud Firebase Siap · Silakan Login Google'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {(!isCommitteeUnlocked || activeModule === AppModule.PESERTA) && (
          <PesertaModule
            config={state.config}
            participants={state.participants}
            materials={state.materials}
            photos={state.photos}
            selectedParticipantId={selectedParticipantId}
            firebaseUser={
              firebaseUser
                ? {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                  }
                : null
            }
            onGooglePopupSignIn={async () => {
              await signInWithGooglePopup();
            }}
            onGoogleSignOut={async () => {
              await signOutFromGoogle();
            }}
            onSelectParticipant={setSelectedParticipantId}
            onCheckIn={(pId, day) => handleCheckIn(pId, day, false)}
            onSaveBiodata={handleSaveBiodata}
            onUploadDocument={handleUploadDocument}
            onSaveSppr={handleSaveSppr}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {isCommitteeUnlocked && activeModule === AppModule.PROXY_PANITIA && (
          <ProxyPanitiaModule
            config={state.config}
            participants={state.participants}
            onSaveBiodata={handleSaveBiodata}
            onCheckIn={handleCheckIn}
            onUploadDocument={handleUploadDocument}
          />
        )}

        {isCommitteeUnlocked && activeModule === AppModule.VERIFIKATOR_SPJ && (
          <VerifikatorSpjModule
            config={state.config}
            participants={state.participants}
            speakers={state.speakers}
            onVerifyParticipant={handleVerifyParticipant}
            onUploadLateFinanceProof={handleUploadDocument}
            onUpsertSpeaker={handleUpsertSpeaker}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {isCommitteeUnlocked && activeModule === AppModule.DOKUMENTASI && (
          <DokumentasiModule
            config={state.config}
            photos={state.photos}
            onUploadPhoto={handleUploadPhoto}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {isCommitteeUnlocked && activeModule === AppModule.PPTK_EXECUTIVE && (
          <PptkExecutiveModule
            config={state.config}
            participants={state.participants}
            speakers={state.speakers}
            photos={state.photos}
            auditLogs={state.auditLogs}
            onUpdateConfig={handleUpdateConfig}
            onResetOfficialMode={handleResetOfficialMode}
            onRestoreDemoData={handleRestoreDemoData}
            onOpenDocumentPreview={setPreviewDoc}
            onOpenBlueprint={() => setIsBlueprintOpen(true)}
          />
        )}
      </main>

      {/* Footer Resmi */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div>
            SIM-KANTOR — {state.config.instansiPenyelenggara} ({state.config.tahunAnggaran})
          </div>
          <div className="text-[11px] text-slate-400">
            Database Real-Time Cloud Firebase &amp; Google Auth Terintegrasi
          </div>
        </div>
      </footer>

      {/* Modal Login PIN Panitia / Verifikator / PPTK */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                <span>Akses Ruang Kerja Panitia &amp; Verifikator</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUnlockCommittee} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Masukkan Kode PIN Panitia untuk membuka modul{' '}
                <strong>Verifikator Keuangan SPJ</strong>,{' '}
                <strong>Helpdesk Proxy</strong>, <strong>Dokumentasi</strong>, dan{' '}
                <strong>PPTK &amp; Pengaturan Kegiatan</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Kode PIN Panitia (Default: <span className="font-mono">2025</span>)
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Masukkan PIN Panitia (2025)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 font-mono text-sm tracking-widest focus:border-blue-700 focus:outline-none"
                />
                {pinError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{pinError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="min-h-[40px] rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] rounded-lg bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-600"
                >
                  Buka Panel Panitia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pratinjau & Cetak Dokumen PDF Resmi */}
      <DocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Modal Kode Backend Vercel Serverless & Panduan Konfigurasi */}
      <VercelBlueprintModal
        isOpen={isBlueprintOpen}
        onClose={() => setIsBlueprintOpen(false)}
        connectionMode={state.connectionMode}
        serviceAccountEmail={state.serviceAccountEmail}
        googleSheetId={state.googleSheetId}
        googleDriveParentFolderId={state.googleDriveParentFolderId}
      />
    </div>
  );
}
