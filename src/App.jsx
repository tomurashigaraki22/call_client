import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaPhone } from "react-icons/fa";
import './App.css'

function UserCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [params, setParams] = useState({ driverId: "", userId: "" });
  const [newSocket, setNewSocket] = useState(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const peerConnections = useRef({});
  const localStream = useRef(null);
  const audioRef = useRef(null);

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
          setCallStatus("Call Accepted");
          setIsIncomingCall(false);
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    });

    socket.on("endCall", () => {
      console.log("Call ended");
      setCallStatus("Call Ended");
      endCall();
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

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection(servers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        newSocket.emit("ice-candidate", {
          to: userId,
          from: params.userId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.streams[0]);
      if (event.streams && event.streams[0]) {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(error => console.error("Error playing audio:", error));
        }
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
      const pc = peerConnections.current[params.driverId];

      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      newSocket.emit("answer", { 
        to: params.driverId, 
        from: params.userId,
        answer 
      });
      
      setIsIncomingCall(false);

      // Attempt to play audio when call is accepted
        try {
          await audioRef.current.play();
          console.log("Audio playback started successfully");
        } catch (error) {
          console.error("Error playing audio:", error);
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
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setCallStatus("Call Ended");
    newSocket.emit("endCall", { to: params.driverId, from: params.userId });
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#000", // Black background
        color: "#fff", // White text
      }}
    >
      {/* Caller Info */}
      <div
        style={{
          textAlign: "center",
          marginTop: 50,
        }}
      >
        <div
          style={{
            fontSize: "2rem",
            fontWeight: "600",
            marginBottom: "8px", // Add spacing between title and status
          }}
        >
          User
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            opacity: 0.8, // Slight transparency for call status
          }}
        >
          {callStatus}
        </div>
      </div>
  
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
  
      {/* Call Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "16px",
          gap: "32px", // Equal spacing between buttons,
          position: 'absolute',
          bottom: 20,
          width: '100%'
        }}
      >
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{
            padding: "15px",
            borderRadius: "50%",
            backgroundColor: "transparent",
            border: "2px solid #fff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            transition: "transform 0.2s", // Button interaction effect
          }}
        >
          {isMuted ? (
            <FaMicrophoneSlash style={{ color: "#fff", fontSize: "1rem" }} />
          ) : (
            <FaMicrophone style={{ color: "#fff", fontSize: "1rem" }} />
          )}
        </button>
  
        {/* Accept or Start Call Button */}
        {isIncomingCall ? (
          <button
            onClick={acceptCall}
            style={{
              padding: "15px",
              borderRadius: "50%",
              backgroundColor: "#f27e05", // Orange for accepting calls
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              transition: "transform 0.2s", // Interaction effect
            }}
          >
            <FaPhone style={{ color: "#fff", fontSize: "1rem" }} />
          </button>
        ) : (
          <button
            onClick={startCall}
            style={{
              padding: "15px",
              borderRadius: "50%",
              backgroundColor: "#34D399", // Green for starting calls
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              transition: "transform 0.2s", // Interaction effect
            }}
          >
            <FaPhoneAlt style={{ color: "#fff", fontSize: "1rem" }} />
          </button>
        )}
  
        {/* End Call Button */}
        <button
          onClick={endCall}
          style={{
            padding: "15px",
            borderRadius: "50%",
            backgroundColor: "#e11d48", // Red for ending calls
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            transition: "transform 0.2s", // Interaction effect
          }}
        >
          <FaPhoneAlt
            style={{
              color: "#fff",
              fontSize: "1rem",
              transform: "rotate(180deg)", // Icon flipped for end call
            }}
          />
        </button>
      </div>
    </div>
  );
  
}

export default UserCall;
