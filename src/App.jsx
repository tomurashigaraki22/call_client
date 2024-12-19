import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaPhone } from "react-icons/fa";
import "./App.css";

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
      socket.emit("register_user", { email: params.driverId });
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
          to: userId,
          from: params.driverId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.streams[0]);
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
      const pc = createPeerConnection(params.userId);
      peerConnections.current[params.userId] = pc;

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
        to: params.userId,
        from: params.driverId,
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
      const callerId = Object.keys(peerConnections.current)[0]; // Get the caller's ID
      const pc = peerConnections.current[callerId];

      if (!pc) {
        throw new Error("No peer connection found for the incoming call");
      }

      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      newSocket.emit("answer", { 
        to: callerId, 
        from: params.driverId,
        answer 
      });
      setIsIncomingCall(false);

      // Start playing the audio
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
        try {
          await remoteAudioRef.current.play();
          console.log("Remote audio playback started");
        } catch (error) {
          console.error("Error playing remote audio:", error);
        }
      }

    } catch (error) {
      console.error("Error accepting call:", error);
      alert(`Failed to accept call. Error: ${error.message}`);
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
      alert("No audio source available")
    }
  };

  return (
    <div className="call-screen">
      <div className="caller-info">
        <div className="caller-name">Driver</div>
        <div className="call-status">{callStatus}</div>
      </div>

      <div>
        <audio ref={remoteAudioRef} playsInline />
        <button onClick={playAudio} className="play-audio-button">
          Play Audio
        </button>
      </div>

      <div className="call-controls">
        <button onClick={toggleMute} className="control-button">
          {isMuted ? (
            <FaMicrophoneSlash className="control-icon red" />
          ) : (
            <FaMicrophone className="control-icon white" />
          )}
        </button>

        {isIncomingCall ? (
          <button onClick={acceptCall} className="control-button green-bg">
            <FaPhone className="control-icon white" />
          </button>
        ) : (
          <button onClick={startCall} className="control-button green-bg">
            <FaPhoneAlt className="control-icon white" />
          </button>
        )}

        <button onClick={endCall} className="control-button red-bg">
          <FaPhoneAlt className="control-icon white rotate-icon" />
        </button>
      </div>
    </div>
  );
}

export default DriverCall;

