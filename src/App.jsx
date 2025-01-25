import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";
import { FiPhoneOff, FiMic, FiMicOff } from "react-icons/fi";
import "./main.css";

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState("Connecting...");
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState(""); // Set this dynamically
  const [isMuted, setIsMuted] = useState(false);
  const [call, setCall] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const driverId = urlParams.get("driverId");
  const userId = urlParams.get("userId");
  const isInitiator = urlParams.get("initiator") === "true";

  const localPeerId = userId;
  const targetPeerId = driverId;

  useEffect(() => {
    const newPeer = new Peer(localPeerId);
    setPeer(newPeer);

    newPeer.on("open", (id) => {
      setPeerId(id);
      console.log("Peer ID:", id);
    });

    newPeer.on("call", (incomingCall) => {
      console.log("I'm being called")
      setCallStatus("Ringing...");
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        localAudioRef.current.srcObject = stream;
        incomingCall.answer(stream);
        setCall(incomingCall);

        incomingCall.on("stream", (remoteStream) => {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play();
          setCallStatus("In Call");
        });
      });
    });

    newPeer.on("connection", (conn) => {
      conn.on("open", () => {
        console.log("Connected to peer:", conn.peer);
        if (isInitiator){
          startCall(conn.peer);
        }
      });
    });

    return () => {
      if (newPeer) newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    let intervalId;

    const checkAndConnectToPeer = () => {
      if (!targetPeerId) return;

      const conn = peer.connect(targetPeerId);
      conn.on("open", () => {
        console.log("Connection established with:", targetPeerId);
        setCallStatus("Peer Connected");
        startCall(targetPeerId);

        clearInterval(intervalId);
      });

      conn.on("error", (err) => {
        console.error("Connection failed, retrying...", err);
      });
    };

    if (isInitiator && peer) {
      intervalId = setInterval(() => {
        checkAndConnectToPeer();
      }, 2000);
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [isInitiator, peer]);

  const startCall = (remotePeerId) => {
    if (!remotePeerId) {
      console.error("Cannot start call, remotePeerId is undefined.");
      return;
    }
  
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localAudioRef.current.srcObject = stream;
      const outgoingCall = peer.call(remotePeerId, stream);
  
      if (!outgoingCall) {
        console.error("Outgoing call failed.");
        return;
      }
  
      console.log("outgoing: ", call)
      setCall(outgoingCall);
      outgoingCall.on("stream", (remoteStream) => {
        console.log("Stream: ", remoteStream)
        remoteAudioRef.current.srcObject = remoteStream;
        setCallStatus("In Call");
      });
  
      setCallStatus("Calling...");
    }).catch((err) => console.error("Failed to access audio stream:", err));
  };
  
  useEffect(() => {
    console.log("Target Peer ID:", targetPeerId);
  }, [targetPeerId]);
  
  const endCall = () => {
    if (call) {
      call.close();
      setCallStatus("Call Ended");
    }
  };

  const toggleMute = () => {
    if (localAudioRef.current) {
      const stream = localAudioRef.current.srcObject;
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  return (
    <div
      style={{
        textAlign: "center",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #1e293b, #334155)",
        color: "white",
      }}
    >
      <div>
        <p style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>
          {callStatus}
        </p>
      </div>

      <audio ref={localAudioRef} autoPlay muted style={{ display: "none" }} />
      <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />

      <div
        style={{
          display: "flex",
          gap: "40px",
          position: "absolute",
          bottom: "10%",
          width: "100%",
          justifyContent: "center",
        }}
      >
        <button
          onClick={endCall}
          style={{
            padding: "20px",
            backgroundColor: "red",
            border: "none",
            borderRadius: "50%",
            color: "white",
            fontSize: "24px",
            cursor: "pointer",
            boxShadow: "0 5px 10px rgba(0, 0, 0, 0.3)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <FiPhoneOff size={30} />
        </button>

        <button
          onClick={toggleMute}
          style={{
            padding: "20px",
            backgroundColor: isMuted ? "gray" : "green",
            border: "none",
            borderRadius: "50%",
            color: "white",
            fontSize: "24px",
            cursor: "pointer",
            boxShadow: "0 5px 10px rgba(0, 0, 0, 0.3)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isMuted ? <FiMicOff size={30} /> : <FiMic size={30} />}
        </button>
      </div>
    </div>
  );
};

export default CallScreen;
