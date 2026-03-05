"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IntakeMode = "VOICE_AUTO" | "MANUAL";
type VoiceStep =
  | "BOOTING"
  | "ASK_NAME"
  | "RESOLVE_NAME"
  | "ASK_LAST4"
  | "ASK_FOOD_INFO"
  | "CONFIRM_TEXT"
  | "ASK_PHOTO"
  | "CAPTURE_PHOTO"
  | "SUBMIT"
  | "DONE"
  | "MANUAL";

type VoiceFailureReason = "MIC_PERMISSION" | "STT_FAILED" | "EXTRACTION_FAILED" | "TIMEOUT";

type TranscribeIntent = "IDENTITY_NAME" | "FOOD_INFO" | "EMPLOYEE_LAST4";

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

type Last4TranscribeResponse = {
  transcript: string;
  intent: "EMPLOYEE_LAST4";
  extracted: {
    employeeNoLast4: string | null;
    confidence: number;
  };
  validationErrors: string[];
};

type TranscribeResultMap = {
  IDENTITY_NAME: IdentityTranscribeResponse;
  FOOD_INFO: FoodTranscribeResponse;
  EMPLOYEE_LAST4: Last4TranscribeResponse;
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
  const [mode, setMode] = useState<IntakeMode>("VOICE_AUTO");
  const [step, setStep] = useState<VoiceStep>("BOOTING");
  const [message, setMessage] = useState("초기화 중...");

  const [recordingSupported, setRecordingSupported] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);

  const [selectedMember, setSelectedMember] = useState<MemberCandidate | null>(null);
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);

  const [nameQuery, setNameQuery] = useState("");
  const [foodName, setFoodName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [transcript, setTranscript] = useState("");
  const [photoObjectKey, setPhotoObjectKey] = useState("");

  const [isBusy, setIsBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const [failureCounts, setFailureCounts] = useState<Record<TranscribeIntent, number>>({
    IDENTITY_NAME: 0,
    FOOD_INFO: 0,
    EMPLOYEE_LAST4: 0
  });

  const mountedRef = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const maxExpiryDate = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + 6);
    return now.toISOString().slice(0, 10);
  }, []);

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
    if (mountedRef.current) {
      return;
    }

    mountedRef.current = true;
    void beginAutoFlow();
  }, [recordingSupported, cameraSupported, speechSupported]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

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

  function resetSession() {
    setStep("BOOTING");
    setSelectedMember(null);
    setMemberCandidates([]);
    setNameQuery("");
    setFoodName("");
    setExpiryDate("");
    setTranscript("");
    setPhotoObjectKey("");
    setFailureCounts({
      IDENTITY_NAME: 0,
      FOOD_INFO: 0,
      EMPLOYEE_LAST4: 0
    });
    setCapturedPhoto(null);
    setSelectedPhoto(null);

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl("");
    stopCamera();
  }

  function switchToManual(messageText: string) {
    setMode("MANUAL");
    setStep("MANUAL");
    setMessage(messageText);
  }

  function increaseFailure(intent: TranscribeIntent) {
    setFailureCounts((prev) => ({
      ...prev,
      [intent]: prev[intent] + 1
    }));
  }

  async function handleRetryOrManual(intent: TranscribeIntent, reason: VoiceFailureReason, reasonMessage: string) {
    if (reason === "MIC_PERMISSION") {
      switchToManual("마이크 권한이 없어 직접 등록 모드로 전환합니다.");
      return;
    }

    const nextCount = failureCounts[intent] + 1;
    increaseFailure(intent);

    if (nextCount <= 1) {
      setMessage(`${reasonMessage} 한 번 더 자동으로 시도합니다.`);
      await speak(`${reasonMessage} 다시 시도합니다.`);
      return;
    }

    switchToManual(`${reasonMessage} 직접 등록 모드로 전환합니다.`);
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

  async function uploadAudioBlob(blob: Blob) {
    const mimeType = blob.type || "audio/webm";
    const urlInfo = await requestUploadUrl("audio", mimeType);
    await putFile(urlInfo.uploadUrl, blob, mimeType);
    return urlInfo.objectKey;
  }

  async function uploadPhotoBlob(blob: Blob, contentType = "image/jpeg") {
    const urlInfo = await requestUploadUrl("photo", contentType);
    await putFile(urlInfo.uploadUrl, blob, contentType);
    setPhotoObjectKey(urlInfo.objectKey);
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

  async function transcribe<TIntent extends TranscribeIntent>(
    intent: TIntent,
    blob: Blob
  ): Promise<TranscribeResultMap[TIntent]> {
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

    const data = (await response.json()) as TranscribeResultMap[TIntent];
    return data;
  }

  async function recordSingleUtterance(maxDurationMs: number, silenceDurationMs: number): Promise<Blob> {
    if (!recordingSupported) {
      throw new Error("MIC_PERMISSION");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    let startedSpeech = false;
    let lastVoiceTs = Date.now();
    const startTs = Date.now();

    const sampleLoop = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / dataArray.length);
      const now = Date.now();

      if (rms > 0.03) {
        startedSpeech = true;
        lastVoiceTs = now;
      }

      if (now - startTs >= maxDurationMs) {
        if (recorder.state === "recording") {
          recorder.stop();
        }
        return;
      }

      if (startedSpeech && now - lastVoiceTs >= silenceDurationMs) {
        if (recorder.state === "recording") {
          recorder.stop();
        }
        return;
      }

      if (recorder.state === "recording") {
        requestAnimationFrame(sampleLoop);
      }
    };

    return await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        reject(new Error("STT_FAILED"));
      };

      recorder.onstop = async () => {
        try {
          source.disconnect();
          analyser.disconnect();
          await audioContext.close();
        } catch {
          // ignore
        }

        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          reject(new Error("TIMEOUT"));
          return;
        }
        resolve(blob);
      };

      recorder.start();
      requestAnimationFrame(sampleLoop);
    });
  }

  async function captureIntent<TIntent extends TranscribeIntent>(intent: TIntent, maxDurationMs: number) {
    try {
      setIsBusy(true);
      const blob = await recordSingleUtterance(maxDurationMs, 1200);
      if (selectedMember) {
        await uploadAudioBlob(blob);
      }
      const result = await transcribe(intent, blob);
      setTranscript(result.transcript ?? "");
      return result as TranscribeResultMap[TIntent];
    } catch (error) {
      const msg = String(error);
      if (msg.includes("MIC_PERMISSION") || msg.includes("NotAllowedError")) {
        await handleRetryOrManual(intent, "MIC_PERMISSION", "마이크 권한을 확인해주세요.");
      } else if (msg.includes("TIMEOUT")) {
        await handleRetryOrManual(intent, "TIMEOUT", "음성이 감지되지 않았습니다.");
      } else {
        await handleRetryOrManual(intent, "STT_FAILED", "음성 인식에 실패했습니다.");
      }
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function askAndResolveName() {
    setStep("ASK_NAME");
    setMessage("성함을 말씀해주세요.");
    await speak("성함을 말씀해주세요.");

    setStep("RESOLVE_NAME");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntent("IDENTITY_NAME", 8000);
      if (!result || mode !== "VOICE_AUTO") {
        continue;
      }

      const extractedName = result.extracted.nameCandidate?.trim();
      const transcriptName = result.transcript?.trim();
      const candidateName = extractedName || transcriptName;

      if (!candidateName) {
        await handleRetryOrManual("IDENTITY_NAME", "EXTRACTION_FAILED", "이름 인식에 실패했습니다.");
        continue;
      }

      setNameQuery(candidateName);

      const candidates = await lookupByName(candidateName);
      if (candidates.length === 0) {
        await handleRetryOrManual("IDENTITY_NAME", "EXTRACTION_FAILED", "해당 이름의 구성원을 찾지 못했습니다.");
        continue;
      }

      if (candidates.length === 1) {
        setSelectedMember(candidates[0]);
        setMemberCandidates([]);
        setMessage(`구성원 확인: ${candidates[0].name} (${candidates[0].department})`);
        return true;
      }

      setMemberCandidates(candidates);
      return await askAndResolveLast4(candidates);
    }

    return false;
  }

  async function askAndResolveLast4(candidates: MemberCandidate[]) {
    setStep("ASK_LAST4");

    const candidateText = candidates
      .map((c) => `${c.department}은 ${c.employeeNoLast4}`)
      .join(", ");

    setMessage("동명이인이 있습니다. 사번 끝 4자리를 말씀해주세요.");
    await speak(`동명이인이 있습니다. 사번 끝 네 자리를 말씀해주세요. ${candidateText}`);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntent("EMPLOYEE_LAST4", 8000);
      if (!result || mode !== "VOICE_AUTO") {
        continue;
      }

      const extracted = result.extracted.employeeNoLast4?.replace(/\D/g, "");
      const transcriptDigits = result.transcript.replace(/\D/g, "");
      const last4 = (extracted || transcriptDigits).slice(-4);

      if (!last4 || last4.length !== 4) {
        await handleRetryOrManual("EMPLOYEE_LAST4", "EXTRACTION_FAILED", "사번 끝 4자리 인식에 실패했습니다.");
        continue;
      }

      const matched = candidates.find((c) => c.employeeNoLast4 === last4);
      if (!matched) {
        await handleRetryOrManual("EMPLOYEE_LAST4", "EXTRACTION_FAILED", "해당 사번 끝 4자리가 후보 목록과 일치하지 않습니다.");
        continue;
      }

      setSelectedMember(matched);
      setMemberCandidates([]);
      setMessage(`구성원 확인: ${matched.name} (${matched.department})`);
      return true;
    }

    return false;
  }

  async function askAndResolveFoodInfo() {
    if (!selectedMember) {
      return false;
    }

    setStep("ASK_FOOD_INFO");
    setMessage("음식명과 유통기한을 말씀해주세요.");
    await speak(
      `${selectedMember.name}님 안녕하세요. 보관하고자 하는 음식이 무엇인지, 언제까지 보관할지 말씀해주세요.`
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await captureIntent("FOOD_INFO", 15000);
      if (!result || mode !== "VOICE_AUTO") {
        continue;
      }

      const nextFoodName = result.extracted.foodName?.trim() || "";
      const nextExpiryDate = result.extracted.expiryDate?.trim() || "";

      if (!nextFoodName || !nextExpiryDate) {
        await handleRetryOrManual("FOOD_INFO", "EXTRACTION_FAILED", "음식 정보 인식에 실패했습니다.");
        continue;
      }

      setFoodName(nextFoodName);
      setExpiryDate(nextExpiryDate);
      setStep("CONFIRM_TEXT");
      setMessage(`인식 완료: ${nextFoodName}, ${nextExpiryDate}`);
      await speak(`${nextFoodName}, ${nextExpiryDate}로 등록합니다.`);
      return true;
    }

    return false;
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
      switchToManual("카메라를 사용할 수 없어 직접 등록 모드로 전환합니다.");
      return false;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      return true;
    } catch {
      switchToManual("카메라 권한이 없어 직접 등록 모드로 전환합니다.");
      return false;
    }
  }

  async function autoCapturePhoto(): Promise<Blob | null> {
    setStep("ASK_PHOTO");
    await speak("음식 사진을 등록합니다. 음식을 놓아주세요. 3초 후 자동 촬영합니다.");

    const started = await startCamera();
    if (!started) {
      return null;
    }

    setStep("CAPTURE_PHOTO");
    setMessage("카메라를 켰습니다. 자동 촬영 중...");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (nextBlob) => {
          resolve(nextBlob);
        },
        "image/jpeg",
        0.92
      );
    });

    if (!blob) {
      return null;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setCapturedPhoto(blob);
    setPhotoPreviewUrl(URL.createObjectURL(blob));
    stopCamera();

    return blob;
  }

  async function submitFood(photoKey: string) {
    if (!selectedMember) {
      return false;
    }

    setStep("SUBMIT");
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
          photoObjectKey: photoKey
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(`등록 실패: ${errorText}`);
        switchToManual("등록 중 오류가 발생해 직접 등록 모드로 전환합니다.");
        return false;
      }

      const data = (await response.json()) as { foodItemId: string };
      setStep("DONE");
      setMessage(`등록 완료: ${data.foodItemId}`);
      await speak("음식 등록이 완료되었습니다.");
      return true;
    } catch {
      switchToManual("등록 중 오류가 발생해 직접 등록 모드로 전환합니다.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function beginAutoFlow() {
    if (mode !== "VOICE_AUTO") {
      return;
    }

    resetSession();
    setMessage("음성 자동 등록을 시작합니다.");

    if (!recordingSupported) {
      switchToManual("마이크를 사용할 수 없어 직접 등록 모드로 전환합니다.");
      return;
    }

    const nameResolved = await askAndResolveName();
    if (!nameResolved || mode !== "VOICE_AUTO") {
      return;
    }

    const foodResolved = await askAndResolveFoodInfo();
    if (!foodResolved || mode !== "VOICE_AUTO") {
      return;
    }

    const photoBlob = await autoCapturePhoto();
    if (!photoBlob || mode !== "VOICE_AUTO") {
      switchToManual("사진 자동 촬영에 실패해 직접 등록 모드로 전환합니다.");
      return;
    }

    try {
      const photoKey = await uploadPhotoBlob(photoBlob, "image/jpeg");
      const success = await submitFood(photoKey);
      if (success) {
        setTimeout(() => {
          if (mode === "VOICE_AUTO") {
            void beginAutoFlow();
          }
        }, 4000);
      }
    } catch {
      switchToManual("사진 업로드에 실패해 직접 등록 모드로 전환합니다.");
    }
  }

  async function manualLookupName() {
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
        setSelectedMember(candidates[0]);
        setMemberCandidates([]);
        setMessage(`구성원 확인: ${candidates[0].name} (${candidates[0].department})`);
      } else {
        setMessage("후보 목록에서 구성원을 선택해주세요.");
      }
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function manualUploadPhoto() {
    if (!selectedPhoto) {
      setMessage("사진 파일을 선택해주세요.");
      return;
    }

    try {
      const key = await uploadPhotoBlob(selectedPhoto, selectedPhoto.type || "image/jpeg");
      setMessage(`사진 업로드 완료: ${key}`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function manualSubmit() {
    if (!photoObjectKey) {
      setMessage("사진 업로드를 먼저 완료해주세요.");
      return;
    }
    await submitFood(photoObjectKey);
  }

  return (
    <main style={{ maxWidth: 780, margin: "24px auto", fontFamily: "system-ui, sans-serif", padding: "0 12px" }}>
      <h1>냉장고 등록 태블릿</h1>

      <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: "#445" }}>
          <div>모드: {mode === "VOICE_AUTO" ? "완전 자동 음성 등록" : "직접 등록"}</div>
          <div>단계: {step}</div>
          {isBusy ? <div>처리 중...</div> : null}
        </div>

        {selectedMember ? (
          <p style={{ marginTop: 8 }}>
            확인된 사용자: {selectedMember.name} ({selectedMember.department}) / 사번 끝
            {selectedMember.employeeNoLast4}
          </p>
        ) : null}

        {memberCandidates.length > 0 ? (
          <div style={{ marginTop: 8, padding: 8, background: "#f8fbff", borderRadius: 6 }}>
            <strong>동명이인 후보</strong>
            <ul>
              {memberCandidates.map((candidate) => (
                <li key={`${candidate.memberId}-${candidate.employeeNoLast4}`}>
                  {candidate.name} / {candidate.department} / 사번 끝 {candidate.employeeNoLast4}
                </li>
              ))}
            </ul>
            <p>음성으로 사번 끝 4자리를 말하면 자동 선택합니다.</p>
          </div>
        ) : null}
      </section>

      {mode === "VOICE_AUTO" ? (
        <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>자동 등록 진행 정보</strong>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div>이름 인식어: {nameQuery || "-"}</div>
            <div>음식명: {foodName || "-"}</div>
            <div>유통기한: {expiryDate || "-"}</div>
            <div>사진 키: {photoObjectKey || "-"}</div>
          </div>

          {cameraOpen ? (
            <div style={{ marginTop: 10 }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", borderRadius: 6, background: "#111" }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          ) : null}

          {!cameraOpen && photoPreviewUrl ? (
            <div style={{ marginTop: 10 }}>
              <img
                src={photoPreviewUrl}
                alt="captured preview"
                style={{ width: "100%", borderRadius: 6, background: "#111" }}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>직접 등록</h2>

          <div style={{ marginBottom: 10 }}>
            <label htmlFor="manual-name">이름으로 구성원 찾기</label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                id="manual-name"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="예: 홍길동"
                style={{ flex: 1, padding: 8 }}
              />
              <button type="button" onClick={() => void manualLookupName()}>
                조회
              </button>
            </div>
          </div>

          {memberCandidates.length > 0 ? (
            <div style={{ marginBottom: 10, display: "grid", gap: 6 }}>
              {memberCandidates.map((candidate) => (
                <button
                  key={`${candidate.memberId}-${candidate.employeeNoLast4}`}
                  type="button"
                  onClick={() => {
                    setSelectedMember(candidate);
                    setMemberCandidates([]);
                  }}
                  style={{ textAlign: "left", padding: 8 }}
                >
                  {candidate.name} / {candidate.department} / 사번 끝 {candidate.employeeNoLast4}
                </button>
              ))}
            </div>
          ) : null}

          <input
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="음식명"
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <input
            type="date"
            value={expiryDate}
            max={maxExpiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />

          <div style={{ marginBottom: 8 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedPhoto(e.target.files?.[0] ?? null)}
              style={{ width: "100%" }}
            />
            <button type="button" onClick={() => void manualUploadPhoto()} disabled={!selectedPhoto}>
              사진 업로드
            </button>
          </div>

          <button type="button" onClick={() => void manualSubmit()}>
            등록
          </button>
          <button
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setMode("VOICE_AUTO");
              void beginAutoFlow();
            }}
          >
            자동 음성 모드 재시작
          </button>
        </section>
      )}

      {transcript ? (
        <section style={{ border: "1px solid #d5d9e2", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>최근 음성 인식 결과</strong>
          <p style={{ marginTop: 6 }}>{transcript}</p>
        </section>
      ) : null}

      <section style={{ border: "1px solid #e2e6ef", borderRadius: 8, padding: 12 }}>
        <strong>안내</strong>
        <p style={{ marginTop: 6 }}>{message}</p>
      </section>
    </main>
  );
}
