import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaPhone } from "react-icons/fa";
import './App.css'

function DriverCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [params, setParams] = useState({ driverId: "", userId: "" });
  const [newSocket, setNewSocket] = useState(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const peerConnections = useRef({});
  const localStream = useRef(null);
  const remoteAudioRef = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    const initializeParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setParams({
        driverId: urlParams.get("driverId") || "",
        userId: urlParams.get("userId") || "",
      });
    };

    initializeParams();
  }, []);

  useEffect(() => {
    const socket = io("wss://dropserver.onrender.com", {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    setNewSocket(socket);

    socket.on("connect", () => {
      console.log("Connected to socket.io successfully");
      socket.emit("register_user", { email: params.userId });
    });

    socket.on("offer", async (data) => {
      console.log("Received offer:", data);
      setCallStatus("Incoming Call...");
      setIsIncomingCall(true);
      const pc = createPeerConnection(data.from);
      peerConnections.current[data.from] = pc;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    });

    socket.on("answer", async (data) => {
      console.log("Received answer:", data);
      if (peerConnections.current[data.from]) {
        try {
          await peerConnections.current[data.from].setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          try {
            await remoteAudioRef.current.play();
            console.log("Audio playback started successfully");
          } catch (error) {
            console.error("Error playing audio:", error);
          }
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    });

    socket.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate:", data);
      if (peerConnections.current[data.from]) {
        try {
          await peerConnections.current[data.from].addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [params]);

  const createPeerConnection = (driverId) => {
    const pc = new RTCPeerConnection(servers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        newSocket.emit("ice-candidate", {
          to: driverId,
          from: params.userId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.streams[0]);
      console.log("Track type:", event.track.kind);
      console.log("Track settings:", event.track.getSettings());
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(error => console.error("Error playing audio:", error));
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      setCallStatus("Starting Call...");
      const pc = createPeerConnection(params.driverId);
      peerConnections.current[params.driverId] = pc;

      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Local description set:", pc.localDescription);

      newSocket.emit("offer", {
        to: params.driverId,
        from: params.userId,
        offer,
      });
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Error occurred: " + error);
    }
  };

  const acceptCall = async () => {
    try {
      setCallStatus("Call Accepted");
      const pc = peerConnections.current[params.userId];

      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      newSocket.emit("answer", { 
        to: params.userId, 
        from: params.driverId,
        answer 
      });
      setIsIncomingCall(false);

      // Start playing the audio
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
        try {
          await remoteAudioRef.current.play();
          console.log("Audio playback started successfully");
        } catch (error) {
          console.error("Error playing audio:", error);
        }
      }
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Failed to accept call.");
    }
  };

  const endCall = () => {
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setCallStatus("Call Ended");
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const playAudio = () => {
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play().catch(error => console.error("Error playing audio:", error));
    } else {
      console.log("No audio source available yet");
    }
  };

  return (
    <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'black', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {/* Caller Info */}
      <div style={{ marginBottom: 'auto', textAlign: 'center', marginTop: 20 }}>
        <div style={{ fontSize: '32px', fontWeight: '600' }}>Driver</div>
        <div style={{ fontSize: '14px', marginTop: '8px' }}>{callStatus}</div>
      </div>
  
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
  
      {/* Call Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '16px', position: 'absolute', bottom: 10, width: '100%' }}>
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{ padding: '12px', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {isMuted ? (
            <FaMicrophoneSlash style={{ color: 'white', fontSize: '24px' }} />
          ) : (
            <FaMicrophone style={{ color: 'white', fontSize: '24px' }} />
          )}
        </button>
  
        {/* Accept or Start Call Button */}
        {isIncomingCall ? (
          <button
            onClick={acceptCall}
            style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#f27e05', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <FaPhone style={{ color: 'white', fontSize: '24px' }} />
          </button>
        ) : (
          <button
            onClick={startCall}
            style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#4CAF50', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <FaPhoneAlt style={{ color: 'white', fontSize: '24px' }} />
          </button>
        )}
  
        {/* End Call Button */}
        <button
          onClick={endCall}
          style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#D32F2F', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <FaPhoneAlt style={{ color: 'white', fontSize: '24px', transform: 'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  );
  
}

export default DriverCall;
