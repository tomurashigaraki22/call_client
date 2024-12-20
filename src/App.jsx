import React, { useState, useEffect, useRef } from 'react';
import { FaPhone, FaMicrophone, FaPhoneSlash } from 'react-icons/fa';
import Peer from 'peerjs';

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState('Ringing');
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
  
  const localPeerId = driverId?.slice(0, 4);
  const remotePeerId = userId?.slice(0, 4);

  useEffect(() => {
    const newPeer = new Peer(localPeerId);
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setPeerId(id);
    });

    newPeer.on('call', (call) => {
      setCallStatus('Ringing');
      setCallDetails(call);
    });

    return () => {
      if (newPeer) {
        newPeer.destroy();
      }
    };
  }, []);

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
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localAudioRef.current.srcObject = stream;
        const call = peer.call(remotePeerId, stream);
        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
          remoteAudioRef.current.srcObject = remoteStream;
        });
        setCallStatus('In Call');
      })
      .catch((err) => {
        alert(`Error accessing media: ${err}`);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', backgroundColor: '#1D4ED8', color: 'white', padding: '20px' }}>
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>{callStatus}</div>
          {callStatus === 'In Call' && (
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{formatTime(timer)}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
        {callStatus === 'Ringing' && (
          <button onClick={acceptCall} style={{ padding: '16px', backgroundColor: '#10B981', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
            <FaPhone size={30} />
          </button>
        )}
        {callStatus === 'In Call' && (
          <>
            <button onClick={toggleMute} style={{ padding: '16px', backgroundColor: '#F59E0B', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
              <FaMicrophone size={30} className={isMuted ? 'opacity-50' : ''} />
            </button>
            <button onClick={endCall} style={{ padding: '16px', backgroundColor: '#EF4444', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
              <FaPhoneSlash size={30} />
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
        <audio ref={localAudioRef} autoPlay muted style={{ width: '0', height: '0' }} />
        {remoteStream && (
          <audio ref={remoteAudioRef} autoPlay style={{ width: '0', height: '0' }} />
        )}
      </div>

      {(localPeerId === driverId.slice(0, 4) || localPeerId === userId.slice(0, 4)) && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={() => startCall(remotePeerId)} style={{ padding: '16px', backgroundColor: '#3B82F6', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
            Start Call
          </button>
        </div>
      )}
    </div>
  );
};

export default CallScreen;
