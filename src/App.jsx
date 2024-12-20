import React, { useState, useEffect, useRef } from 'react';
import { FaPhone, FaMicrophone, FaPhoneSlash } from 'react-icons/fa';
import Peer from 'peerjs';

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [callDetails, setCallDetails] = useState(null);
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');
  const driverId = urlParams.get('driverId');
  const initiator = urlParams.get('initiator');
  
  const localPeerId = driverId?.slice(0, 4);
  const remotePeerId = userId?.slice(0, 4);

  useEffect(() => {
    const newPeer = new Peer(localPeerId);
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setPeerId(id);
    });

    // Automatically accept the call
    newPeer.on('call', async (call) => {
      setCallStatus('Ringing');
      setCallDetails(call);

      // Automatically answer the call with the local stream
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          localAudioRef.current.srcObject = stream; // Local stream for the caller
          localAudioRef.current.muted = true; // Mute local audio to avoid feedback

          call.answer(stream); // Automatically answer the call

          call.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
            remoteAudioRef.current.srcObject = remoteStream; // Set the remote stream
          });

          setCallStatus('In Call');
        })
        .catch((err) => {
          console.error("Error accessing media devices: ", err);
        });
    });

    return () => {
      if (newPeer) {
        newPeer.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (initiator === 'true' && peer && remotePeerId) {
      startCall(remotePeerId);  // Ensure `peer` is initialized before starting the call
    }
  }, [initiator, peer, remotePeerId]);  // Add `peer` and `remotePeerId` to dependencies to ensure the call happens when the peer is ready

  useEffect(() => {
    if (callStatus === 'In Call') {
      const id = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      setIntervalId(id);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [callStatus]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${minutes}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (localAudioRef.current && localAudioRef.current.srcObject) {
      localAudioRef.current.srcObject.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  };

  const endCall = () => {
    setCallStatus('Ended');
    if (peer && callDetails) {
      callDetails.close();
    }
    clearInterval(intervalId);
  };

  const acceptCall = () => {
    if (callDetails) {
      callDetails.answer(localAudioRef.current.srcObject);
      callDetails.on('stream', (stream) => {
        setRemoteStream(stream);
        remoteAudioRef.current.srcObject = stream;
      });
      setCallStatus('In Call');
    }
  };

  const startCall = (remotePeerId) => {
    if (!peer) {
      console.error('Peer connection is not initialized yet!');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localAudioRef.current.srcObject = stream; // Local stream for the caller
        localAudioRef.current.muted = true; // Mute local audio to avoid feedback

        const call = peer.call(remotePeerId, stream); // Initiate the call

        // Automatically handle incoming stream for the remote party
        call.on('stream', (remoteStream) => {
          console.log("I got a stream: ", remoteStream);
          setRemoteStream(remoteStream);
          remoteAudioRef.current.srcObject = remoteStream; // Set the remote stream
        });

        call.on('error', (err) => {
          console.error("Call error: ", err);
        });

        setCallStatus('In Call');
      })
      .catch((err) => {
        alert(`Error accessing media: ${err}`);
      });
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between', 
      height: '100vh', 
      backgroundColor: '#075E54', 
      color: 'white', 
      padding: '20px', 
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif' 
    }}>
      {/* Header - Call Status */}
      <div>
        <div style={{ fontSize: '28px', fontWeight: '600', marginBottom: '20px' }}>
          {callStatus}
        </div>
        {callStatus === 'In Call' && (
          <div style={{ fontSize: '22px', fontWeight: '500' }}>
            {formatTime(timer)}
          </div>
        )}
      </div>

      {/* Centered Audio Stream / Caller */}
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '40px', fontWeight: '700', color: 'white' }}>
          {remoteStream ? 'Remote Caller' : 'Waiting for Connection'}
        </div>
      </div>

      {/* Call Control Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '20px' }}>
        {callStatus === 'Ringing' && (
          <button onClick={acceptCall} style={buttonStyles('#10B981')}>
            <FaPhone size={32} />
          </button>
        )}
        {callStatus === 'In Call' && (
          <>
            <button onClick={toggleMute} style={buttonStyles('#F59E0B')}>
              <FaMicrophone size={32} className={isMuted ? 'opacity-50' : ''} />
            </button>
            <button onClick={endCall} style={buttonStyles('#EF4444')}>
              <FaPhoneSlash size={32} />
            </button>
          </>
        )}
      </div>

      {/* Hidden Audio Streams */}
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

    </div>
  );
};

// Button Styles
const buttonStyles = (bgColor) => ({
  padding: '20px',
  backgroundColor: bgColor,
  borderRadius: '50%',
  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '24px',
});

export default CallScreen;
