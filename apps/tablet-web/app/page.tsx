"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IntakeMode = "VOICE_WIZARD" | "MANUAL";
type WizardStep =
  | "IDLE"
  | "ASK_NAME"
  | "LISTEN_NAME"
  | "DISAMBIGUATE_MEMBER"
  | "ASK_FOOD_INFO"
  | "LISTEN_FOOD_INFO"
  | "CONFIRM_TEXT"
  | "ASK_PHOTO"
  | "CAPTURE_PHOTO"
  | "SUBMIT"
  | "DONE"
  | "MANUAL_MODE"
  | "ERROR";

type VoiceIntent = "IDENTITY_NAME" | "FOOD_INFO";
type VoiceFailureReason = "MIC_PERMISSION" | "STT_FAILED" | "EXTRACTION_FAILED" | "TIMEOUT";

type MemberStatus = "ACTIVE" | "INACTIVE";

type MemberCandidate = {
  memberId: string;
  name: string;
  department: string;
  employeeNoLast4: string;
  email: string;
  status: MemberStatus;
};

type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
};

type IdentityTranscribeResponse = {
  transcript: string;
  intent: "IDENTITY_NAME";
  extracted: {
    nameCandidate: string | null;
    confidence: number;
  };
  validationErrors: string[];
};

type FoodTranscribeResponse = {
  transcript: string;
  intent: "FOOD_INFO";
  extracted: {
    foodName: string | null;
    expiryDate: string | null;
    confidence: number;
  };
  validationErrors: string[];
};

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
}

function toVoiceFile(blob: Blob) {
  const mimeType = blob.type || "audio/webm";
  const ext = mimeType.includes("ogg") ? "ogg" : "webm";
  return new File([blob], `voice.${ext}`, { type: mimeType });
}

export default function TabletPage() {
  const [apiBase, setApiBase] = useState("http://localhost:4000");
  const [mode, setMode] = useState<IntakeMode>("VOICE_WIZARD");
  const [wizardStep, setWizardStep] = useState<WizardStep>("IDLE");
  const [message, setMessage] = useState("");

  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberCandidate | null>(null);
  const [nameQuery, setNameQuery] = useState("");

  const [foodName, setFoodName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [transcript, setTranscript] = useState("");

  const [photoObjectKey, setPhotoObjectKey] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  const [recordingSupported, setRecordingSupported] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [voiceFailureCounts, setVoiceFailureCounts] = useState<Record<VoiceIntent, number>>({
    IDENTITY_NAME: 0,
    FOOD_INFO: 0
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingIntentRef = useRef<VoiceIntent | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setApiBase(getApiBase());
    setRecordingSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function"
    );
    setCameraSupported(
      typeof window !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
    );
    setSpeechSupported(typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined");
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      stopCamera();
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (mode !== "VOICE_WIZARD") {
      return;
    }

    if (wizardStep === "CAPTURE_PHOTO") {
      void startCamera();
      return;
    }

    stopCamera();
  }, [mode, wizardStep]);

  const maxExpiryDate = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + 6);
    return now.toISOString().slice(0, 10);
  }, []);

  function actorHeaders(): Record<string, string> {
    if (!selectedMember) {
      return {};
    }

    return {
      "x-member-id": selectedMember.memberId
    };
  }

  async function speak(text: string) {
    if (!speechSupported || typeof window === "undefined") {
      return;
    }

    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  function resetRegistrationFields() {
    setFoodName("");
    setExpiryDate("");
    setTranscript("");
    setPhotoObjectKey("");
    setSelectedPhoto(null);
    setCapturedPhoto(null);
    setMemberCandidates([]);
    setVoiceFailureCounts({ IDENTITY_NAME: 0, FOOD_INFO: 0 });
    setCameraError(null);
    setCameraOpen(false);

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl("");
  }

  function switchToManual(reasonMessage: string, reason?: VoiceFailureReason) {
    stopRecording();
    stopCamera();
    setMode("MANUAL");
    setWizardStep("MANUAL_MODE");
    setMessage(reasonMessage);
    if (reason) {
      void speak(`${reasonMessage} 직접 등록 모드로 전환합니다.`);
    }
  }

  function updateVoiceFailure(intent: VoiceIntent) {
    setVoiceFailureCounts((prev) => ({
      ...prev,
      [intent]: prev[intent] + 1
    }));
  }

  async function handleVoiceFailure(intent: VoiceIntent, reason: VoiceFailureReason, reasonMessage: string) {
    if (reason === "MIC_PERMISSION") {
      switchToManual("마이크 권한이 필요합니다.", reason);
      return;
    }

    const nextFailures = voiceFailureCounts[intent] + 1;
    updateVoiceFailure(intent);

    if (nextFailures <= 1) {
      setMessage(`${reasonMessage} 한 번 더 시도해주세요.`);
      if (intent === "IDENTITY_NAME") {
        setWizardStep("LISTEN_NAME");
        await speak("성함을 다시 말씀해주세요.");
      } else {
        setWizardStep("LISTEN_FOOD_INFO");
        await speak("음식 이름과 보관 기한을 다시 말씀해주세요.");
      }
      return;
    }

    switchToManual(`${reasonMessage} 직접 등록으로 전환합니다.`, reason);
  }

  async function requestUploadUrl(kind: "photo" | "audio", contentType: string) {
    const response = await fetch(`${apiBase}/v1/assets/upload-url`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...actorHeaders()
      },
      body: JSON.stringify({ kind, contentType })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`업로드 URL 요청 실패: ${text}`);
    }

    return (await response.json()) as UploadUrlResponse;
  }

  async function putFile(uploadUrl: string, blob: Blob, contentType: string) {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: blob
    });

    if (!uploadResponse.ok) {
      throw new Error("파일 업로드 실패");
    }
  }

  async function uploadPhotoBlob(blob: Blob, contentType = "image/jpeg") {
    if (!selectedMember) {
      throw new Error("구성원 확인이 필요합니다");
    }

    const urlInfo = await requestUploadUrl("photo", contentType);
    await putFile(urlInfo.uploadUrl, blob, contentType);
    setPhotoObjectKey(urlInfo.objectKey);
    setMessage(`사진 업로드 완료: ${urlInfo.objectKey}`);
    return urlInfo.objectKey;
  }

  async function lookupByName(query: string) {
    const response = await fetch(`${apiBase}/v1/auth/name-lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nameQuery: query })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`이름 조회 실패: ${text}`);
    }

    const data = (await response.json()) as { candidates: MemberCandidate[] };
    return data.candidates;
  }

  async function startVoiceWizard() {
    stopRecording();
    stopCamera();
    resetRegistrationFields();
    setMode("VOICE_WIZARD");
    setWizardStep("ASK_NAME");
    setSelectedMember(null);
    setMessage("음성 등록을 시작합니다.");

    await speak("성함을 말씀해주세요.");
    setWizardStep("LISTEN_NAME");
  }

  async function selectMember(candidate: MemberCandidate) {
    setSelectedMember(candidate);
    setMemberCandidates([]);
    setVoiceFailureCounts((prev) => ({ ...prev, IDENTITY_NAME: 0 }));
    setMessage(`구성원 확인: ${candidate.name} (${candidate.department})`);

    if (mode === "VOICE_WIZARD") {
      setWizardStep("ASK_FOOD_INFO");
      await speak(
        `${candidate.name}님 안녕하세요. 보관하고자 하는 음식이 무엇인지, 언제까지 보관하실 건지 알려주세요.`
      );
      setWizardStep("LISTEN_FOOD_INFO");
    }
  }

  async function resolveNameFromTranscript(nameCandidate: string) {
    const candidates = await lookupByName(nameCandidate);

    if (candidates.length === 0) {
      await handleVoiceFailure("IDENTITY_NAME", "EXTRACTION_FAILED", "해당 이름의 구성원을 찾지 못했습니다.");
      return;
    }

    setNameQuery(nameCandidate);

    if (candidates.length === 1) {
      await selectMember(candidates[0]);
      return;
    }

    setMemberCandidates(candidates);
    setWizardStep("DISAMBIGUATE_MEMBER");
    setMessage("동명이인이 있습니다. 사번 끝 4자리 버튼을 선택해주세요.");
    await speak("동명이인이 있습니다. 화면에서 사번 끝 네 자리를 선택해주세요.");
  }

  function clearRecordingTimer() {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function transcribe(intent: "IDENTITY_NAME", blob: Blob): Promise<IdentityTranscribeResponse>;
  async function transcribe(intent: "FOOD_INFO", blob: Blob): Promise<FoodTranscribeResponse>;
  async function transcribe(intent: VoiceIntent, blob: Blob): Promise<IdentityTranscribeResponse | FoodTranscribeResponse> {
    const form = new FormData();
    form.append("audio", toVoiceFile(blob));
    form.append("intent", intent);

    const response = await fetch(`${apiBase}/v1/intake/transcribe`, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "음성 인식 실패");
    }

    const body = await response.json();
    if (intent === "IDENTITY_NAME") {
      return body as IdentityTranscribeResponse;
    }
    return body as FoodTranscribeResponse;
  }

  async function handleRecordedAudio(intent: VoiceIntent, blob: Blob) {
    setIsBusy(true);
    setMessage("음성 분석 중입니다...");

    try {
      if (intent === "IDENTITY_NAME") {
        const data = await transcribe("IDENTITY_NAME", blob);
        setTranscript(data.transcript ?? "");

        const extractedName = data.extracted.nameCandidate?.trim();
        const transcriptName = data.transcript?.trim();
        const candidateName = extractedName || transcriptName;

        if (!candidateName) {
          await handleVoiceFailure(intent, "EXTRACTION_FAILED", "이름 인식에 실패했습니다.");
          return;
        }

        await resolveNameFromTranscript(candidateName);
        return;
      }

      const data = await transcribe("FOOD_INFO", blob);
      setTranscript(data.transcript ?? "");

      const extractedFoodName = data.extracted.foodName?.trim() || "";
      const extractedExpiryDate = data.extracted.expiryDate?.trim() || "";

      if (extractedFoodName) {
        setFoodName(extractedFoodName);
      }
      if (extractedExpiryDate) {
        setExpiryDate(extractedExpiryDate);
      }

      const isValid = extractedFoodName.length > 0 && extractedExpiryDate.length > 0;
      if (!isValid) {
        await handleVoiceFailure(intent, "EXTRACTION_FAILED", "음식명 또는 유통기한 인식에 실패했습니다.");
        return;
      }

      setVoiceFailureCounts((prev) => ({ ...prev, FOOD_INFO: 0 }));
      setWizardStep("CONFIRM_TEXT");

      if (data.validationErrors.length > 0) {
        setMessage(`인식 완료(확인 필요): ${data.validationErrors.join(", ")}`);
      } else {
        setMessage("음성 인식 완료. 내용을 확인해주세요.");
      }
    } catch (error) {
      await handleVoiceFailure(intent, "STT_FAILED", `음성 인식 실패: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function startRecording(intent: VoiceIntent) {
    if (isRecording) {
      return;
    }

    if (!recordingSupported) {
      await handleVoiceFailure(intent, "MIC_PERMISSION", "이 기기에서 음성 녹음을 사용할 수 없습니다.");
      return;
    }

    clearRecordingTimer();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });

        clearRecordingTimer();
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        audioStreamRef.current = null;
        setIsRecording(false);

        if (blob.size === 0) {
          await handleVoiceFailure(intent, "TIMEOUT", "음성이 감지되지 않았습니다.");
          return;
        }

        await handleRecordedAudio(intent, blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      audioStreamRef.current = stream;
      recordingIntentRef.current = intent;
      setIsRecording(true);
      setMessage("녹음 중입니다...");

      const timeoutMs = intent === "IDENTITY_NAME" ? 8_000 : 15_000;
      recordTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, timeoutMs);
    } catch {
      await handleVoiceFailure(intent, "MIC_PERMISSION", "마이크 권한이 거부되었습니다.");
    }
  }

  function stopRecording() {
    clearRecordingTimer();

    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
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

  async function startCamera() {
    if (!cameraSupported) {
      switchToManual("카메라를 사용할 수 없어 직접 등록으로 전환합니다.");
      return;
    }

    try {
      stopCamera();
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      setMessage("촬영 버튼을 눌러 사진을 등록해주세요.");
    } catch {
      setCameraError("카메라 접근에 실패했습니다. 파일 업로드로 등록해주세요.");
      if (mode === "VOICE_WIZARD") {
        switchToManual("카메라 권한이 없어 직접 등록으로 전환합니다.");
      }
    }
  }

  function capturePhotoFromCamera() {
    if (!videoRef.current || !canvasRef.current) {
      setMessage("카메라가 준비되지 않았습니다.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setMessage("카메라 프레임을 가져오지 못했습니다.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("카메라 캡처 처리에 실패했습니다.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("사진 캡처에 실패했습니다.");
          return;
        }

        if (photoPreviewUrl) {
          URL.revokeObjectURL(photoPreviewUrl);
        }

        const preview = URL.createObjectURL(blob);
        setPhotoPreviewUrl(preview);
        setCapturedPhoto(blob);
        stopCamera();
        setMessage("사진을 확인한 뒤 확정하거나 재촬영하세요.");
      },
      "image/jpeg",
      0.92
    );
  }

  async function confirmCapturedPhoto() {
    if (!capturedPhoto) {
      setMessage("먼저 사진을 촬영해주세요.");
      return;
    }

    setIsBusy(true);
    try {
      const objectKey = await uploadPhotoBlob(capturedPhoto, "image/jpeg");

      if (mode === "VOICE_WIZARD") {
        setWizardStep("SUBMIT");
        await submitFood(objectKey);
      }
    } catch (error) {
      setMessage(`사진 업로드 실패: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadSelectedPhoto() {
    if (!selectedPhoto) {
      setMessage("사진 파일을 선택해주세요.");
      return;
    }

    setIsBusy(true);
    try {
      const objectKey = await uploadPhotoBlob(selectedPhoto, selectedPhoto.type || "image/jpeg");
      if (mode === "VOICE_WIZARD") {
        setWizardStep("SUBMIT");
        await submitFood(objectKey);
      }
    } catch (error) {
      setMessage(`사진 업로드 실패: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function moveToAskPhoto() {
    setWizardStep("ASK_PHOTO");
    const userName = selectedMember?.name ?? "사용자";
    await speak(`${userName}님 음식 사진을 등록해주세요.`);
    setWizardStep("CAPTURE_PHOTO");
  }

  async function submitFood(photoKeyOverride?: string) {
    if (!selectedMember) {
      setMessage("구성원을 먼저 확인해주세요.");
      return;
    }

    const finalPhotoKey = photoKeyOverride || photoObjectKey;

    if (!foodName || !expiryDate) {
      setMessage("음식명과 유통기한을 입력해주세요.");
      return;
    }

    if (!finalPhotoKey) {
      setMessage("사진 등록이 필요합니다.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(`${apiBase}/v1/foods`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders()
        },
        body: JSON.stringify({
          memberId: selectedMember.memberId,
          foodName,
          expiryDate,
          photoObjectKey: finalPhotoKey
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(`등록 실패: ${errorText}`);
        setWizardStep(mode === "VOICE_WIZARD" ? "ERROR" : "MANUAL_MODE");
        return;
      }

      const data = (await response.json()) as { foodItemId: string };
      setWizardStep("DONE");
      setMessage(`등록 완료: ${data.foodItemId}`);
      await speak("음식 등록이 완료되었습니다.");
    } catch (error) {
      setMessage(`등록 오류: ${String(error)}`);
      setWizardStep(mode === "VOICE_WIZARD" ? "ERROR" : "MANUAL_MODE");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleManualNameLookup() {
    if (!nameQuery.trim()) {
      setMessage("이름을 입력해주세요.");
      return;
    }

    try {
      const candidates = await lookupByName(nameQuery.trim());
      setMemberCandidates(candidates);

      if (candidates.length === 0) {
        setMessage("일치하는 구성원을 찾지 못했습니다.");
      } else if (candidates.length === 1) {
        await selectMember(candidates[0]);
      } else {
        setMessage("구성원 후보를 선택해주세요.");
      }
    } catch (error) {
      setMessage(String(error));
    }
  }

  function renderMemberCandidates() {
    if (memberCandidates.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {memberCandidates.map((candidate) => (
          <button
            type="button"
            key={`${candidate.memberId}-${candidate.employeeNoLast4}`}
            onClick={() => void selectMember(candidate)}
            style={{ textAlign: "left", padding: 10 }}
          >
            {candidate.name} / {candidate.department} / 사번 끝 {candidate.employeeNoLast4}
          </button>
        ))}
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui, sans-serif", padding: "0 12px" }}>
      <h1>냉장고 등록 태블릿</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void startVoiceWizard()}>
          음식 등록 시작
        </button>
        {mode === "VOICE_WIZARD" ? (
          <button type="button" onClick={() => switchToManual("직접 등록 모드로 전환합니다.")}>직접 등록</button>
        ) : (
          <button type="button" onClick={() => void startVoiceWizard()}>음성 등록으로 복귀</button>
        )}
      </div>

      <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: "#445" }}>
          <div>모드: {mode === "VOICE_WIZARD" ? "음성 위저드" : "직접 등록"}</div>
          <div>단계: {wizardStep}</div>
        </div>

        {selectedMember ? (
          <p style={{ marginTop: 8 }}>
            확인된 사용자: {selectedMember.name} ({selectedMember.department}) / 사번 끝
            {selectedMember.employeeNoLast4}
          </p>
        ) : null}

        {mode === "VOICE_WIZARD" ? (
          <>
            {(wizardStep === "LISTEN_NAME" || wizardStep === "LISTEN_FOOD_INFO") && (
              <div style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 6 }}>
                  {wizardStep === "LISTEN_NAME"
                    ? "성함을 말씀하시고 말하기 버튼을 눌러주세요"
                    : "음식명과 유통기한을 말씀하시고 말하기 버튼을 눌러주세요"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      void startRecording(wizardStep === "LISTEN_NAME" ? "IDENTITY_NAME" : "FOOD_INFO")
                    }
                    disabled={isRecording || isBusy}
                  >
                    말하기 시작
                  </button>
                  <button type="button" onClick={stopRecording} disabled={!isRecording || isBusy}>
                    말하기 중지
                  </button>
                </div>
                {!recordingSupported ? (
                  <p style={{ marginTop: 6, fontSize: 13, color: "#a24600" }}>
                    현재 브라우저는 마이크 녹음을 지원하지 않습니다.
                  </p>
                ) : null}
              </div>
            )}

            {wizardStep === "DISAMBIGUATE_MEMBER" && (
              <div style={{ marginTop: 10 }}>
                <div>동명이인 확인: 아래 후보에서 선택해주세요.</div>
                {renderMemberCandidates()}
              </div>
            )}

            {wizardStep === "CONFIRM_TEXT" && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <input
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="음식명"
                  style={{ width: "100%", padding: 8 }}
                />
                <input
                  type="date"
                  value={expiryDate}
                  max={maxExpiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                />
                <button type="button" onClick={() => void moveToAskPhoto()} disabled={isBusy}>
                  이 내용으로 진행
                </button>
              </div>
            )}

            {wizardStep === "CAPTURE_PHOTO" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8 }}>사진 촬영</div>
                {cameraError ? <p style={{ color: "#a24600" }}>{cameraError}</p> : null}
                {!cameraError ? (
                  <>
                    {!capturedPhoto ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", borderRadius: 6, background: "#111" }}
                      />
                    ) : (
                      <img
                        src={photoPreviewUrl}
                        alt="captured preview"
                        style={{ width: "100%", borderRadius: 6, background: "#111" }}
                      />
                    )}
                  </>
                ) : null}

                <canvas ref={canvasRef} style={{ display: "none" }} />

                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!capturedPhoto ? (
                    <button type="button" onClick={capturePhotoFromCamera} disabled={isBusy}>
                      촬영
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          if (photoPreviewUrl) {
                            URL.revokeObjectURL(photoPreviewUrl);
                          }
                          setPhotoPreviewUrl("");
                          void startCamera();
                        }}
                        disabled={isBusy}
                      >
                        재촬영
                      </button>
                      <button type="button" onClick={() => void confirmCapturedPhoto()} disabled={isBusy}>
                        사진 확정
                      </button>
                    </>
                  )}
                </div>

                <div style={{ marginTop: 10 }}>
                  <label htmlFor="fallback-photo">카메라 실패 시 파일 업로드</label>
                  <input
                    id="fallback-photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedPhoto(e.target.files?.[0] ?? null)}
                    style={{ width: "100%", marginTop: 6 }}
                  />
                  <button type="button" onClick={() => void uploadSelectedPhoto()} disabled={!selectedPhoto || isBusy}>
                    파일 업로드로 진행
                  </button>
                </div>
              </div>
            )}

            {(wizardStep === "DONE" || wizardStep === "ERROR") && (
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => void startVoiceWizard()}>
                  새 등록 시작
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0 }}>직접 등록</h2>

            <div>
              <label htmlFor="manual-name">이름으로 구성원 찾기</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  id="manual-name"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="예: 홍길동"
                  style={{ flex: 1, padding: 8 }}
                />
                <button type="button" onClick={() => void handleManualNameLookup()}>
                  조회
                </button>
              </div>
              {renderMemberCandidates()}
            </div>

            <input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="음식명"
              style={{ width: "100%", padding: 8 }}
            />
            <input
              type="date"
              value={expiryDate}
              max={maxExpiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />

            <div>
              <label htmlFor="manual-photo">사진 업로드</label>
              <input
                id="manual-photo"
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPhoto(e.target.files?.[0] ?? null)}
                style={{ width: "100%", marginTop: 4 }}
              />
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void uploadSelectedPhoto()} disabled={!selectedPhoto || isBusy}>
                  사진 업로드
                </button>
                {cameraSupported ? (
                  <button type="button" onClick={() => void startCamera()} disabled={isBusy}>
                    카메라 열기
                  </button>
                ) : null}
              </div>
              {photoObjectKey ? <p style={{ marginTop: 6, fontSize: 13 }}>사진 키: {photoObjectKey}</p> : null}
            </div>

            {cameraOpen ? (
              <div style={{ marginTop: 8 }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", borderRadius: 6, background: "#111" }}
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button type="button" onClick={capturePhotoFromCamera}>
                    촬영
                  </button>
                  <button type="button" onClick={stopCamera}>
                    닫기
                  </button>
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            ) : null}

            {capturedPhoto && mode === "MANUAL" ? (
              <div style={{ marginTop: 8 }}>
                <img
                  src={photoPreviewUrl}
                  alt="manual captured preview"
                  style={{ width: "100%", borderRadius: 6, background: "#111" }}
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => void confirmCapturedPhoto()}>
                    사진 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedPhoto(null);
                      if (photoPreviewUrl) {
                        URL.revokeObjectURL(photoPreviewUrl);
                      }
                      setPhotoPreviewUrl("");
                      void startCamera();
                    }}
                  >
                    재촬영
                  </button>
                </div>
              </div>
            ) : null}

            <button type="button" onClick={() => void submitFood()} disabled={isBusy}>
              등록
            </button>
          </div>
        )}
      </section>

      {transcript ? (
        <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>최근 음성 인식 결과</strong>
          <p style={{ marginTop: 6 }}>{transcript}</p>
        </section>
      ) : null}

      {message ? (
        <section style={{ border: "1px solid #e2e6ef", borderRadius: 8, padding: 12 }}>
          <strong>안내</strong>
          <p style={{ marginTop: 6 }}>{message}</p>
        </section>
      ) : null}
    </main>
  );
}
