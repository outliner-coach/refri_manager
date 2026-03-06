"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./tablet-kiosk.module.css";

type IntakeMode = "VOICE" | "MANUAL";
type FlowAction = "REGISTER" | "TAKEAWAY";
type FlowStep =
  | "HOME"
  | "RESOLVE_IDENTITY"
  | "RESOLVE_LAST4"
  | "CAPTURE_FOOD"
  | "CONFIRM_REGISTER"
  | "CAPTURE_PHOTO"
  | "SELECT_TAKEAWAY"
  | "CONFIRM_TAKEAWAY"
  | "MANUAL_REGISTER"
  | "MANUAL_TAKEAWAY"
  | "SUCCESS";
type TranscribeIntent =
  | "IDENTITY_NAME"
  | "FOOD_INFO"
  | "EMPLOYEE_LAST4"
  | "CONFIRMATION"
  | "SELECTION_NUMBER";
type MemberRole = "MEMBER" | "ADMIN";
type FoodStatus = "REGISTERED" | "TAKEN_OUT" | "DISPOSED" | "EXPIRED";

type MemberCandidate = {
  memberId: string;
  name: string;
  department: string;
  employeeNoLast4: string;
  role: MemberRole;
};

type FoodItemSummary = {
  id: string;
  foodName: string;
  status: FoodStatus;
  expiryDate: string;
  isOverdue: boolean;
  photoObjectKey: string | null;
};

type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
};

type TranscribeResultMap = {
  IDENTITY_NAME: { transcript: string; extracted: { nameCandidate: string | null } };
  FOOD_INFO: { transcript: string; extracted: { foodName: string | null; expiryDate: string | null } };
  EMPLOYEE_LAST4: { transcript: string; extracted: { employeeNoLast4: string | null } };
  CONFIRMATION: { transcript: string; extracted: { confirmed: boolean | null } };
  SELECTION_NUMBER: { transcript: string; extracted: { selectedNumber: number | null } };
};

const HOME_MESSAGE = "등록하기 또는 가져가기를 누르면 안내를 시작합니다.";
const RESET_AFTER_MS = 5000;

type MediaSupportState = {
  secureContext: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
};

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    if (window.location.protocol === "https:") {
      return window.location.origin;
    }
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://localhost:4000";
}

function toVoiceFile(blob: Blob) {
  const mimeType = blob.type || "audio/webm";
  const ext = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("mpeg") || mimeType.includes("mp3")
        ? "mp3"
        : "webm";
  return new File([blob], `voice.${ext}`, { type: mimeType });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}

function getRegisterConfirmationMessage(foodName: string, expiryDate: string) {
  return `${foodName}, ${expiryDate}로 등록할까요?`;
}

function getTakeawayConfirmationMessage(foodName: string) {
  return `${foodName}을 가져간 것으로 처리할까요?`;
}

function getVoiceSupportMessage(state: MediaSupportState) {
  if (!state.secureContext) {
    return "현재 접속 주소가 HTTP라 iPad 브라우저에서는 마이크 권한을 요청할 수 없습니다. HTTPS 주소로 접속해야 음성 입력을 사용할 수 있습니다.";
  }
  if (!state.hasGetUserMedia) {
    return "이 브라우저는 마이크 입력 API를 지원하지 않습니다.";
  }
  if (!state.hasMediaRecorder) {
    return "이 브라우저는 음성 녹음을 지원하지 않습니다.";
  }
  return null;
}

function getCameraSupportMessage(state: MediaSupportState) {
  if (!state.secureContext) {
    return "현재 접속 주소가 HTTP라 iPad 브라우저에서는 카메라 권한을 요청할 수 없습니다. HTTPS 주소로 접속해야 촬영 기능을 사용할 수 있습니다.";
  }
  if (!state.hasGetUserMedia) {
    return "이 브라우저는 카메라 입력 API를 지원하지 않습니다.";
  }
  return null;
}

export function TabletKiosk() {
  const [apiBase, setApiBase] = useState("http://localhost:4000");
  const [mode, setMode] = useState<IntakeMode>("VOICE");
  const [activeAction, setActiveAction] = useState<FlowAction | null>(null);
  const [step, setStep] = useState<FlowStep>("HOME");
  const [message, setMessage] = useState(HOME_MESSAGE);
  const [successTitle, setSuccessTitle] = useState("");
  const [successDescription, setSuccessDescription] = useState("");
  const [originLabel, setOriginLabel] = useState("");
  const [voiceSupportMessage, setVoiceSupportMessage] = useState<string | null>(null);
  const [cameraSupportMessage, setCameraSupportMessage] = useState<string | null>(null);

  const [recordingSupported, setRecordingSupported] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [selectedMember, setSelectedMember] = useState<MemberCandidate | null>(null);
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [availableFoodItems, setAvailableFoodItems] = useState<FoodItemSummary[]>([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItemSummary | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [foodName, setFoodName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [photoObjectKey, setPhotoObjectKey] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const flowIdRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);
  const speechPrimedRef = useRef(false);

  const maxExpiryDate = useMemo(() => {
    const value = new Date();
    value.setMonth(value.getMonth() + 6);
    return value.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    setApiBase(getApiBase());
    if (typeof window === "undefined") {
      return;
    }

    const supportState: MediaSupportState = {
      secureContext: window.isSecureContext,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
      hasMediaRecorder: typeof window.MediaRecorder !== "undefined"
    };

    setOriginLabel(window.location.origin);
    setRecordingSupported(
      supportState.secureContext && supportState.hasGetUserMedia && supportState.hasMediaRecorder
    );
    setCameraSupported(supportState.secureContext && supportState.hasGetUserMedia);
    setVoiceSupportMessage(getVoiceSupportMessage(supportState));
    setCameraSupportMessage(getCameraSupportMessage(supportState));
    setSpeechSupported(typeof window.speechSynthesis !== "undefined");
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      clearResetTimer();
      stopSpeech();
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    clearResetTimer();
    if (step !== "SUCCESS") {
      return;
    }

    resetTimerRef.current = window.setTimeout(() => {
      goHome();
    }, RESET_AFTER_MS);
  }, [step]);

  function clearResetTimer() {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  function isFlowCurrent(flowId: number) {
    return flowIdRef.current === flowId;
  }

  function actorHeaders(member: MemberCandidate | null = selectedMember): Record<string, string> {
    const headers: Record<string, string> = {};
    if (member) {
      headers["x-member-id"] = member.memberId;
    }
    return headers;
  }

  function stopSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  function primeSpeechSynthesis() {
    if (!speechSupported || typeof window === "undefined") {
      return;
    }

    if (speechPrimedRef.current) {
      return;
    }

    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      speechPrimedRef.current = true;
    } catch {
      // Ignore browser-specific warmup failures.
    }
  }

  async function ensureSpeechVoicesLoaded() {
    if (!speechSupported || typeof window === "undefined") {
      return;
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        resolve();
      };
      const handleVoicesChanged = () => finish();
      const timeoutId = window.setTimeout(finish, 1200);
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      window.speechSynthesis.getVoices();
    });
  }

  function getPreferredSpeechVoice() {
    if (!speechSupported || typeof window === "undefined") {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
  }

  async function speak(text: string) {
    if (!speechSupported || typeof window === "undefined") {
      return;
    }

    await ensureSpeechVoicesLoaded();

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        resolve();
      };
      const timeoutMs = Math.min(5200, Math.max(2200, text.length * 140));
      const timeoutId = window.setTimeout(() => {
        window.speechSynthesis.cancel();
        finish();
      }, timeoutMs);

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.voice = getPreferredSpeechVoice();
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = finish;
      utterance.onerror = finish;

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }

  function resetFlowState() {
    setSelectedMember(null);
    setMemberCandidates([]);
    setAvailableFoodItems([]);
    setSelectedFoodItem(null);
    setNameQuery("");
    setFoodName("");
    setExpiryDate("");
    setPhotoObjectKey("");
    setSelectedPhoto(null);
    setTranscript("");
    setIsListening(false);
    setSuccessTitle("");
    setSuccessDescription("");
    stopCamera();
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl("");
    }
  }

  function goHome() {
    flowIdRef.current += 1;
    clearResetTimer();
    stopSpeech();
    resetFlowState();
    setMode("VOICE");
    setActiveAction(null);
    setStep("HOME");
    setMessage(HOME_MESSAGE);
  }

  function getVoiceFallbackMessage() {
    return voiceSupportMessage ?? "이 기기에서는 음성 입력을 사용할 수 없어 직접 입력으로 전환합니다.";
  }

  function getCameraFallbackMessage() {
    return cameraSupportMessage ?? "이 기기에서는 카메라를 사용할 수 없어 직접 입력으로 전환합니다.";
  }

  function startManualFlow(action: FlowAction, nextMessage: string) {
    setMode("MANUAL");
    setActiveAction(action);
    setStep(action === "TAKEAWAY" ? "MANUAL_TAKEAWAY" : "MANUAL_REGISTER");
    setMessage(nextMessage);
  }

  function switchToManual(nextMessage = "직접 입력으로 이어갑니다.") {
    setMode("MANUAL");
    setStep(activeAction === "TAKEAWAY" ? "MANUAL_TAKEAWAY" : "MANUAL_REGISTER");
    setMessage(nextMessage);
    if (activeAction === "TAKEAWAY" && selectedMember) {
      void loadActiveFoods(selectedMember);
    }
  }

  async function requestUploadUrl(kind: "photo" | "audio", contentType: string, member = selectedMember) {
    const response = await fetch(`${apiBase}/v1/assets/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json", ...actorHeaders(member) },
      body: JSON.stringify({ kind, contentType })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as UploadUrlResponse;
  }

  async function putFile(uploadUrl: string, blob: Blob, contentType: string) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: blob
    });
    if (!response.ok) {
      throw new Error("파일 업로드에 실패했습니다.");
    }
  }

  async function uploadAudioBlob(blob: Blob, member = selectedMember) {
    const mimeType = blob.type || "audio/webm";
    const uploadInfo = await requestUploadUrl("audio", mimeType, member);
    await putFile(uploadInfo.uploadUrl, blob, mimeType);
  }

  async function uploadPhotoBlob(blob: Blob, contentType = "image/jpeg", member = selectedMember) {
    const uploadInfo = await requestUploadUrl("photo", contentType, member);
    await putFile(uploadInfo.uploadUrl, blob, contentType);
    setPhotoObjectKey(uploadInfo.objectKey);
    return uploadInfo.objectKey;
  }

  async function lookupByName(query: string) {
    const response = await fetch(`${apiBase}/v1/auth/name-lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nameQuery: query })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return ((await response.json()) as { candidates: MemberCandidate[] }).candidates;
  }

  async function loadActiveFoods(member: MemberCandidate) {
    const response = await fetch(`${apiBase}/v1/foods/me?status=REGISTERED`, {
      headers: actorHeaders(member)
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const items = ((await response.json()) as { items: FoodItemSummary[] }).items;
    setAvailableFoodItems(items);
    return items;
  }

  async function transcribe<TIntent extends TranscribeIntent>(intent: TIntent, blob: Blob): Promise<TranscribeResultMap[TIntent]> {
    const form = new FormData();
    form.append("audio", toVoiceFile(blob));
    form.append("intent", intent);
    const response = await fetch(`${apiBase}/v1/intake/transcribe`, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as TranscribeResultMap[TIntent];
  }

  async function primeMicrophoneAccess() {
    if (!recordingSupported) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      const errorText = String(error);
      if (errorText.includes("NotAllowedError")) {
        setMessage("마이크 권한이 거부되어 직접 입력으로 전환합니다.");
        return false;
      }
      if (errorText.includes("NotFoundError")) {
        setMessage("사용 가능한 마이크를 찾지 못해 직접 입력으로 전환합니다.");
        return false;
      }
      setMessage(getVoiceFallbackMessage());
      return false;
    }
  }

  async function recordSingleUtterance(maxDurationMs: number, silenceDurationMs: number) {
    if (!recordingSupported) {
      throw new Error("MIC_PERMISSION");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const AudioContextCtor =
      typeof window !== "undefined"
        ? (window.AudioContext ??
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
    const source = audioContext ? audioContext.createMediaStreamSource(stream) : null;
    const analyser = audioContext ? audioContext.createAnalyser() : null;
    if (source && analyser) {
      analyser.fftSize = 2048;
      source.connect(analyser);
    }
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    let startedSpeech = false;
    let lastVoiceAt = Date.now();
    const startAt = Date.now();
    let silenceFrameRef: number | null = null;
    let stopTimerRef: number | null = null;

    const loop = () => {
      if (!analyser || !data) {
        return;
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const value = (data[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms > 0.03) {
        startedSpeech = true;
        lastVoiceAt = now;
      }
      if (now - startAt >= maxDurationMs || (startedSpeech && now - lastVoiceAt >= silenceDurationMs)) {
        if (recorder.state === "recording") {
          recorder.stop();
        }
        return;
      }
      if (recorder.state === "recording") {
        silenceFrameRef = requestAnimationFrame(loop);
      }
    };

    return await new Promise<Blob>((resolve, reject) => {
      const cleanup = async () => {
        if (silenceFrameRef) {
          cancelAnimationFrame(silenceFrameRef);
          silenceFrameRef = null;
        }
        if (stopTimerRef) {
          window.clearTimeout(stopTimerRef);
          stopTimerRef = null;
        }
        setIsListening(false);
        try {
          source?.disconnect();
          analyser?.disconnect();
          await audioContext?.close();
        } catch {
          // ignore cleanup errors
        }
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = async () => {
        await cleanup();
        reject(new Error("STT_FAILED"));
      };
      recorder.onstop = async () => {
        try {
          await cleanup();
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (blob.size === 0) {
            reject(new Error("TIMEOUT"));
            return;
          }
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      recorder.start();
      setIsListening(true);
      stopTimerRef = window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, maxDurationMs);
      if (audioContext) {
        void audioContext.resume().catch(() => undefined);
      }
      if (analyser && data) {
        silenceFrameRef = requestAnimationFrame(loop);
      }
    });
  }

  function getListeningMessage(intent: TranscribeIntent) {
    switch (intent) {
      case "IDENTITY_NAME":
        return "이름을 말씀해 주세요.";
      case "EMPLOYEE_LAST4":
        return "사번 끝 네 자리를 말씀해 주세요.";
      case "FOOD_INFO":
        return "음식 이름과 유통기한을 말씀해 주세요.";
      case "CONFIRMATION":
        return "네 또는 아니오로 말씀해 주세요.";
      case "SELECTION_NUMBER":
        return "번호를 말씀해 주세요.";
      default:
        return "말씀해 주세요.";
    }
  }

  async function captureIntentWithRetry<TIntent extends TranscribeIntent>(
    intent: TIntent,
    maxDurationMs: number,
    retryPrompt: string,
    member: MemberCandidate | null = selectedMember
  ) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        setIsBusy(true);
        setMessage(getListeningMessage(intent));
        const blob = await recordSingleUtterance(maxDurationMs, 1200);
        if (member) {
          await uploadAudioBlob(blob, member);
        }
        const result = await transcribe(intent, blob);
        setTranscript(result.transcript ?? "");
        return result;
      } catch (error) {
        const errorText = String(error);
        if (
          errorText.includes("MIC_PERMISSION") ||
          errorText.includes("NotAllowedError") ||
          errorText.includes("NotFoundError") ||
          errorText.includes("NotReadableError")
        ) {
          switchToManual(getVoiceFallbackMessage());
          return null;
        }
        if (attempt === 0) {
          setMessage(`${retryPrompt} 다시 한 번 말씀해 주세요.`);
          await speak(`${retryPrompt} 다시 한 번 말씀해 주세요.`);
          continue;
        }
        setMessage(`${retryPrompt} 음성 입력을 마치지 못했습니다.`);
        return null;
      } finally {
        setIsBusy(false);
      }
    }

    return null;
  }

  async function resolveMemberByVoice(flowId: number): Promise<MemberCandidate | null> {
    setStep("RESOLVE_IDENTITY");
    setMessage("이름을 말씀해 주세요.");
    await speak("이름을 말씀해 주세요.");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntentWithRetry("IDENTITY_NAME", 8000, "이름을 다시 말씀해 주세요.");
      if (!result || !isFlowCurrent(flowId)) {
        return null;
      }

      const candidateName = result.extracted.nameCandidate?.trim() || result.transcript.trim();
      if (!candidateName) {
        continue;
      }

      setNameQuery(candidateName);
      const candidates = await lookupByName(candidateName);
      if (!isFlowCurrent(flowId)) {
        return null;
      }

      if (candidates.length === 1) {
        setSelectedMember(candidates[0]);
        return candidates[0];
      }

      if (candidates.length > 1) {
        setMemberCandidates(candidates);
        return resolveMemberByLast4(flowId, candidates);
      }
    }

    setMessage("직접 입력으로 구성원을 찾아 주세요.");
    return null;
  }

  async function resolveMemberByLast4(flowId: number, candidates: MemberCandidate[]) {
    setStep("RESOLVE_LAST4");
    setMessage("동명이인이 있어 사번 끝 네 자리를 말씀해 주세요.");
    await speak("동명이인이 있어 사번 끝 네 자리를 말씀해 주세요.");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntentWithRetry("EMPLOYEE_LAST4", 8000, "사번 끝 네 자리를 다시 말씀해 주세요.");
      if (!result || !isFlowCurrent(flowId)) {
        return null;
      }

      const last4 = (result.extracted.employeeNoLast4?.replace(/\D/g, "") || result.transcript.replace(/\D/g, "")).slice(-4);
      const matched = candidates.find((candidate) => candidate.employeeNoLast4 === last4);

      if (matched) {
        setSelectedMember(matched);
        setMemberCandidates([]);
        return matched;
      }
    }

    setMessage("일치하는 구성원을 찾지 못해 직접 입력으로 전환합니다.");
    return null;
  }

  async function resolveFoodInfoByVoice(flowId: number, member: MemberCandidate) {
    setStep("CAPTURE_FOOD");
    setMessage("음식 이름과 유통기한을 말씀해 주세요.");
    await speak("음식 이름과 유통기한을 말씀해 주세요.");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntentWithRetry("FOOD_INFO", 15000, "음식 정보를 다시 말씀해 주세요.", member);
      if (!result || !isFlowCurrent(flowId)) {
        return false;
      }

      const nextFoodName = result.extracted.foodName?.trim() || "";
      const nextExpiryDate = result.extracted.expiryDate?.trim() || "";
      if (nextFoodName && nextExpiryDate) {
        setFoodName(nextFoodName);
        setExpiryDate(nextExpiryDate);
        return {
          foodName: nextFoodName,
          expiryDate: nextExpiryDate
        };
      }
    }

    setMessage("음식 정보를 인식하지 못해 직접 입력으로 전환합니다.");
    return null;
  }

  async function confirmByVoice(flowId: number, member: MemberCandidate) {
    const result = await captureIntentWithRetry("CONFIRMATION", 5000, "네 또는 아니오로 다시 말씀해 주세요.", member);
    if (!result || !isFlowCurrent(flowId)) {
      return null;
    }
    return result.extracted.confirmed;
  }

  async function runRegisterFlow(flowId: number) {
    const member = await resolveMemberByVoice(flowId);
    if (!member || !isFlowCurrent(flowId)) {
      return;
    }

    const foodInfo = await resolveFoodInfoByVoice(flowId, member);
    if (!foodInfo || !isFlowCurrent(flowId)) {
      return;
    }

    setStep("CONFIRM_REGISTER");
    setMessage(getRegisterConfirmationMessage(foodInfo.foodName, foodInfo.expiryDate));
    await speak(`${getRegisterConfirmationMessage(foodInfo.foodName, foodInfo.expiryDate)} 네 또는 아니오로 말씀해 주세요.`);
    const confirmed = await confirmByVoice(flowId, member);
    if (confirmed === true) {
      await submitRegisterWithPhoto(flowId, member);
    } else if (confirmed === false) {
      setMessage("등록 내용을 다시 확인해 주세요.");
    }
  }

  async function runTakeawayFlow(flowId: number) {
    const member = await resolveMemberByVoice(flowId);
    if (!member || !isFlowCurrent(flowId)) {
      return;
    }

    const items = await loadActiveFoods(member);
    if (!isFlowCurrent(flowId)) {
      return;
    }

    if (items.length === 0) {
      setSuccessTitle("가져갈 음식 없음");
      setSuccessDescription("현재 등록된 음식이 없습니다.");
      setStep("SUCCESS");
      return;
    }

    if (items.length === 1) {
      setSelectedFoodItem(items[0]);
      await confirmTakeaway(flowId, member, items[0]);
      return;
    }

    setStep("SELECT_TAKEAWAY");
    setMessage("가져갈 음식의 번호를 말씀해 주세요.");
    await speak("가져갈 음식의 번호를 말씀해 주세요.");
    const result = await captureIntentWithRetry("SELECTION_NUMBER", 6000, "번호를 다시 말씀해 주세요.", member);
    if (!result || !isFlowCurrent(flowId)) {
      return;
    }

    const selectedIndex = (result.extracted.selectedNumber ?? 0) - 1;
    if (items[selectedIndex]) {
      setSelectedFoodItem(items[selectedIndex]);
      await confirmTakeaway(flowId, member, items[selectedIndex]);
      return;
    }

    setMessage("카드를 눌러 음식을 선택해 주세요.");
  }

  async function confirmTakeaway(flowId: number, member: MemberCandidate, item: FoodItemSummary) {
    setSelectedFoodItem(item);
    setStep("CONFIRM_TAKEAWAY");
    setMessage(getTakeawayConfirmationMessage(item.foodName));
    await speak(`${getTakeawayConfirmationMessage(item.foodName)} 네 또는 아니오로 말씀해 주세요.`);
    const confirmed = await confirmByVoice(flowId, member);
    if (confirmed === true) {
      await completeTakeaway(member, item);
    } else if (confirmed === false) {
      setMessage("다른 음식을 선택해 주세요.");
    }
  }

  async function startCamera() {
    if (!cameraSupported) {
      switchToManual(getCameraFallbackMessage());
      return false;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      return true;
    } catch {
      switchToManual(getCameraFallbackMessage());
      return false;
    }
  }

  async function submitRegisterWithPhoto(flowId: number, member: MemberCandidate) {
    setStep("CAPTURE_PHOTO");
    setMessage("사진을 촬영합니다. 음식이 잘 보이도록 가운데에 놓아 주세요.");
    await speak("사진을 촬영합니다. 음식이 잘 보이도록 가운데에 놓아 주세요.");
    const ready = await startCamera();
    if (!ready || !isFlowCurrent(flowId) || !videoRef.current || !canvasRef.current) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    const context = canvasRef.current.getContext("2d");
    if (!context || videoRef.current.videoWidth === 0) {
      switchToManual("사진을 촬영하지 못했습니다.");
      return;
    }

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((value) => resolve(value), "image/jpeg", 0.92);
    });
    stopCamera();
    if (!blob) {
      switchToManual("사진을 촬영하지 못했습니다.");
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl(URL.createObjectURL(blob));

    try {
      const nextPhotoKey = await uploadPhotoBlob(blob, "image/jpeg", member);
      const response = await fetch(`${apiBase}/v1/foods`, {
        method: "POST",
        headers: { "content-type": "application/json", ...actorHeaders(member) },
        body: JSON.stringify({
          memberId: member.memberId,
          foodName,
          expiryDate,
          photoObjectKey: nextPhotoKey
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setSuccessTitle("등록 완료");
      setSuccessDescription(`${foodName} 등록이 완료되었습니다.`);
      setStep("SUCCESS");
    } catch (error) {
      switchToManual(String(error));
    }
  }

  async function completeTakeaway(member: MemberCandidate, item: FoodItemSummary) {
    setIsBusy(true);
    try {
      const response = await fetch(`${apiBase}/v1/foods/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders(member) },
        body: JSON.stringify({ status: "TAKEN_OUT" })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setSuccessTitle("가져가기 완료");
      setSuccessDescription(`${item.foodName}을 가져간 것으로 처리했습니다.`);
      setStep("SUCCESS");
    } catch (error) {
      switchToManual(String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function beginFlow(action: FlowAction) {
    flowIdRef.current += 1;
    stopSpeech();
    clearResetTimer();
    resetFlowState();
    setActiveAction(action);
    setMode("VOICE");
    setStep("RESOLVE_IDENTITY");
    setMessage(action === "REGISTER" ? "등록할 분의 이름을 말씀해 주세요." : "가져갈 분의 이름을 말씀해 주세요.");
    primeSpeechSynthesis();

    if (!recordingSupported) {
      startManualFlow(action, getVoiceFallbackMessage());
      return;
    }

    const microphoneReady = await primeMicrophoneAccess();
    if (!microphoneReady) {
      startManualFlow(action, getVoiceFallbackMessage());
      return;
    }

    if (action === "REGISTER") {
      void runRegisterFlow(flowIdRef.current);
      return;
    }
    void runTakeawayFlow(flowIdRef.current);
  }

  function handleMemberCandidateSelect(candidate: MemberCandidate) {
    setSelectedMember(candidate);
    setMemberCandidates([]);

    if (!activeAction) {
      return;
    }

    if (mode === "MANUAL") {
      if (activeAction === "TAKEAWAY") {
        void loadActiveFoods(candidate).then((items) => {
          if (items.length === 0) {
            setMessage("현재 등록된 음식이 없습니다.");
          }
        });
      }
      return;
    }

    if (activeAction === "REGISTER") {
      void (async () => {
        const flowId = flowIdRef.current;
        const foodInfo = await resolveFoodInfoByVoice(flowId, candidate);
        if (!foodInfo || !isFlowCurrent(flowId)) {
          return;
        }
        setStep("CONFIRM_REGISTER");
        setMessage(getRegisterConfirmationMessage(foodInfo.foodName, foodInfo.expiryDate));
      })();
      return;
    }
    void (async () => {
      const items = await loadActiveFoods(candidate);
      if (items.length === 0) {
        setSuccessTitle("가져갈 음식 없음");
        setSuccessDescription("현재 등록된 음식이 없습니다.");
        setStep("SUCCESS");
        return;
      }
      if (items.length === 1) {
        setSelectedFoodItem(items[0]);
        await confirmTakeaway(flowIdRef.current, candidate, items[0]);
        return;
      }
      setStep("SELECT_TAKEAWAY");
      setMessage("카드를 눌러 음식을 선택해 주세요.");
    })();
  }

  async function manualLookupName() {
    if (!nameQuery.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    try {
      const candidates = await lookupByName(nameQuery.trim());
      setMemberCandidates(candidates);
      if (candidates.length === 0) {
        setMessage("일치하는 구성원을 찾지 못했습니다.");
        return;
      }
      if (candidates.length === 1) {
        handleMemberCandidateSelect(candidates[0]);
        return;
      }
      setMessage("구성원 후보를 선택해 주세요.");
    } catch (error) {
      setMessage(`구성원 조회에 실패했습니다. ${String(error)}`);
    }
  }

  async function manualUploadPhoto() {
    if (!selectedMember || !selectedPhoto) {
      setMessage("구성원과 사진을 먼저 선택해 주세요.");
      return;
    }
    try {
      await uploadPhotoBlob(selectedPhoto, selectedPhoto.type || "image/jpeg", selectedMember);
      setMessage("사진 업로드가 완료되었습니다.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function manualSubmitRegister() {
    if (!selectedMember || !photoObjectKey) {
      setMessage("구성원과 사진 업로드를 먼저 완료해 주세요.");
      return;
    }
    const response = await fetch(`${apiBase}/v1/foods`, {
      method: "POST",
      headers: { "content-type": "application/json", ...actorHeaders(selectedMember) },
      body: JSON.stringify({
        memberId: selectedMember.memberId,
        foodName,
        expiryDate,
        photoObjectKey
      })
    });
    if (!response.ok) {
      setMessage(await response.text());
      return;
    }
    setSuccessTitle("등록 완료");
    setSuccessDescription(`${foodName} 등록이 완료되었습니다.`);
    setStep("SUCCESS");
  }

  const showFlow = step !== "HOME";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Fridge Coach</span>
          <h1 className={styles.title}>냉장고 앞에서 바로 끝내는 음성 등록</h1>
          <p className={styles.subtitle}>등록과 반출 절차를 태블릿 화면에서 빠르게 처리합니다.</p>
        </div>
        <div className={styles.mascotCard}>
          <div className={styles.mascotFace}>
            <span />
            <span />
            <i />
          </div>
          <p>차분하게 묻고, 막히면 바로 직접 입력으로 전환해 드립니다.</p>
        </div>
      </section>

      {voiceSupportMessage || cameraSupportMessage ? (
        <section className={styles.noticeCard}>
          <div className={styles.noticeHeader}>
            <span className={styles.noticeBadge}>모바일 권한 안내</span>
            {originLabel ? <code className={styles.noticeCode}>{originLabel}</code> : null}
          </div>
          <h2>현재 접속 환경에서는 일부 권한 요청이 제한됩니다.</h2>
          <div className={styles.noticeList}>
            {voiceSupportMessage ? <p>마이크: {voiceSupportMessage}</p> : null}
            {cameraSupportMessage ? <p>카메라: {cameraSupportMessage}</p> : null}
          </div>
        </section>
      ) : null}

      {step === "HOME" ? (
        <section className={styles.homeCard}>
          <button type="button" className={styles.mainAction} onClick={() => void beginFlow("REGISTER")}>
            <strong>등록하기</strong>
            <span>{recordingSupported ? "음식 이름, 유통기한, 촬영까지 한 번에" : "현재는 직접 입력으로 이어집니다."}</span>
          </button>
          <button type="button" className={styles.altAction} onClick={() => void beginFlow("TAKEAWAY")}>
            <strong>가져가기</strong>
            <span>{recordingSupported ? "이름을 말하고 등록된 음식을 골라 처리" : "현재는 직접 입력으로 이어집니다."}</span>
          </button>
        </section>
      ) : null}

      {showFlow ? (
        <>
          <section className={styles.card}>
            <div className={styles.toolbar}>
              <div>
                <span className={styles.badge}>{activeAction === "REGISTER" ? "등록" : "가져가기"}</span>
                <h2>{mode === "VOICE" ? "음성 진행" : "직접 입력"}</h2>
              </div>
              <div className={styles.buttonRow}>
                {step !== "SUCCESS" ? (
                  <button type="button" className={styles.softButton} onClick={() => switchToManual()}>
                    직접 입력
                  </button>
                ) : null}
                {mode === "MANUAL" && step !== "SUCCESS" ? (
                  <button type="button" className={styles.softButton} onClick={() => void beginFlow(activeAction ?? "REGISTER")}>
                    음성으로 다시
                  </button>
                ) : null}
                <button type="button" className={styles.ghostButton} onClick={goHome}>
                  처음으로
                </button>
              </div>
            </div>
            <div className={styles.summary}>
              <div>
                <span>단계</span>
                <strong>{step}</strong>
              </div>
              <div>
                <span>구성원</span>
                <strong>{selectedMember ? `${selectedMember.name} / ${selectedMember.department}` : "-"}</strong>
              </div>
              <div>
                <span>선택 항목</span>
                <strong>{foodName || selectedFoodItem?.foodName || "-"}</strong>
              </div>
            </div>
            {isListening ? (
              <div className={styles.livePill} aria-live="polite">
                <span className={styles.liveDot} />
                마이크 듣는 중
              </div>
            ) : null}
          </section>

          {memberCandidates.length > 0 ? (
            <section className={styles.card}>
              <h3>구성원 후보</h3>
              <div className={styles.grid}>
                {memberCandidates.map((candidate) => (
                  <button key={candidate.memberId} type="button" className={styles.optionCard} onClick={() => handleMemberCandidateSelect(candidate)}>
                    <strong>{candidate.name}</strong>
                    <span>{candidate.department}</span>
                    <span>사번 끝 {candidate.employeeNoLast4}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === "CONFIRM_REGISTER" ? (
            <section className={styles.card}>
              <h3>등록 내용 확인</h3>
              <div className={styles.confirmBox}>
                <strong>{foodName || "-"}</strong>
                <span>{expiryDate || "-"}</span>
              </div>
              <div className={styles.buttonRow}>
                <button type="button" className={styles.primaryButton} onClick={() => selectedMember && void submitRegisterWithPhoto(flowIdRef.current, selectedMember)}>
                  이대로 등록
                </button>
                <button
                  type="button"
                  className={styles.softButton}
                  onClick={() =>
                    selectedMember &&
                    void (async () => {
                      const foodInfo = await resolveFoodInfoByVoice(flowIdRef.current, selectedMember);
                      if (!foodInfo || !isFlowCurrent(flowIdRef.current)) {
                        return;
                      }
                      setStep("CONFIRM_REGISTER");
                      setMessage(getRegisterConfirmationMessage(foodInfo.foodName, foodInfo.expiryDate));
                    })()
                  }
                >
                  다시 말하기
                </button>
              </div>
            </section>
          ) : null}

          {(step === "SELECT_TAKEAWAY" || step === "CONFIRM_TAKEAWAY" || step === "MANUAL_TAKEAWAY") ? (
            <section className={styles.card}>
              <h3>가져갈 음식</h3>
              {mode === "MANUAL" && activeAction === "TAKEAWAY" ? (
                <div className={styles.form}>
                  <label>
                    <span>이름으로 찾기</span>
                    <div className={styles.inline}>
                      <input className={styles.input} value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
                      <button type="button" className={styles.softButton} onClick={() => void manualLookupName()}>
                        조회
                      </button>
                    </div>
                  </label>
                </div>
              ) : null}
              <div className={styles.grid}>
                {availableFoodItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.optionCard} ${selectedFoodItem?.id === item.id ? styles.optionActive : ""}`}
                    onClick={() => {
                      setSelectedFoodItem(item);
                      if (mode === "MANUAL" && selectedMember) {
                        void completeTakeaway(selectedMember, item);
                        return;
                      }
                      if (mode === "VOICE" && selectedMember) {
                        void confirmTakeaway(flowIdRef.current, selectedMember, item);
                      }
                    }}
                  >
                    <strong>
                      {index + 1}. {item.foodName}
                    </strong>
                    <span>{formatDate(item.expiryDate)}</span>
                    <span>{item.isOverdue ? "기한 지남" : "보관 중"}</span>
                  </button>
                ))}
              </div>

              {step === "CONFIRM_TAKEAWAY" && selectedFoodItem ? (
                <div className={styles.buttonRow}>
                  <button type="button" className={styles.primaryButton} onClick={() => selectedMember && void completeTakeaway(selectedMember, selectedFoodItem)}>
                    가져간 것으로 처리
                  </button>
                  <button type="button" className={styles.softButton} onClick={() => setStep("SELECT_TAKEAWAY")}>
                    다시 고르기
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {mode === "MANUAL" && activeAction === "REGISTER" ? (
            <section className={styles.card}>
              <h3>직접 등록</h3>
              <div className={styles.form}>
                <label>
                  <span>이름으로 찾기</span>
                  <div className={styles.inline}>
                    <input className={styles.input} value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
                    <button type="button" className={styles.softButton} onClick={() => void manualLookupName()}>
                      조회
                    </button>
                  </div>
                </label>
                <label>
                  <span>음식 이름</span>
                  <input className={styles.input} value={foodName} onChange={(event) => setFoodName(event.target.value)} />
                </label>
                <label>
                  <span>유통기한</span>
                  <input className={styles.input} type="date" max={maxExpiryDate} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
                </label>
                <label>
                  <span>사진</span>
                  <input className={styles.input} type="file" accept="image/*" onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button type="button" className={styles.softButton} onClick={() => void manualUploadPhoto()}>
                  사진 업로드
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => void manualSubmitRegister()}>
                  등록 완료
                </button>
              </div>
            </section>
          ) : null}

          {step === "CAPTURE_PHOTO" ? (
            <section className={styles.card}>
              <h3>사진 촬영</h3>
              {cameraOpen ? (
                <video ref={videoRef} autoPlay playsInline muted className={styles.media} />
              ) : photoPreviewUrl ? (
                <img src={photoPreviewUrl} alt="captured preview" className={styles.media} />
              ) : (
                <div className={styles.empty}>카메라를 준비하고 있습니다.</div>
              )}
              <canvas ref={canvasRef} className={styles.hidden} />
            </section>
          ) : null}

          {step === "SUCCESS" ? (
            <section className={styles.card}>
              <div className={styles.successBadge}>완료</div>
              <h3>{successTitle}</h3>
              <p>{successDescription}</p>
            </section>
          ) : null}

          {transcript ? (
            <section className={styles.card}>
              <h3>최근 인식 결과</h3>
              <p>{transcript}</p>
            </section>
          ) : null}

          <section className={styles.card}>
            <h3>안내</h3>
            <p>{message}</p>
          </section>
        </>
      ) : null}
    </main>
  );
}

