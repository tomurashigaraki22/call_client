import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { FiPhoneOff, FiMic, FiMicOff } from 'react-icons/fi'; // Importing icons
import './main.css'

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState(''); // Set this dynamically
  const [isMuted, setIsMuted] = useState(false);
  const [call, setCall] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const driverId = urlParams.get('driverId');
  const userId = urlParams.get('userId');
  const isInitiator = urlParams.get('initiator') === 'true';

  const localPeerId = userId;
  const targetPeerId = driverId;

  const startCall = (remotePeerId) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localAudioRef.current.srcObject = stream;
      const outgoingCall = peer.call(remotePeerId, stream);
      setCall(outgoingCall);

      outgoingCall.on('stream', (remoteStream) => {
        remoteAudioRef.current.srcObject = remoteStream;
        setCallStatus('In Call');
      });

      setCallStatus('Calling...');
    });
  };

  const endCall = () => {
    if (call) {
      call.close();
      setCallStatus('Call Ended');
    }
  };

  useEffect(() => {
    const newPeer = new Peer(localPeerId); // Use a predefined Peer ID
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setPeerId(id);
      console.log('Peer ID:', id);
    });

    newPeer.on('call', (incomingCall) => {
      setCallStatus('Ringing...');
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        localAudioRef.current.srcObject = stream;
        incomingCall.answer(stream);
        setCall(incomingCall);

        incomingCall.on('stream', (remoteStream) => {
          remoteAudioRef.current.srcObject = remoteStream;
          setCallStatus('In Call');
        });
      });
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
        console.log('Connected to peer:', conn.peer);
        if (isInitiator) {
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
      conn.on('open', () => {
        console.log('Connection established with:', targetPeerId);
        setCallStatus('Peer Connected');
        startCall(targetPeerId);
    
        // Clear the interval since the connection is established
        clearInterval(intervalId);
      });
    
      conn.on('error', (err) => {
        console.error('Connection failed, retrying...', err);
      });
    };
  
    if (isInitiator && peer) {
      intervalId = setInterval(() => {
        checkAndConnectToPeer();
      }, 2000); // Check every 2 seconds
    }
  
    return () => {
      // Cleanup interval on component unmount or if dependencies change
      clearInterval(intervalId);
    };
  }, [isInitiator, peer]);
  

  

  const toggleMute = () => {
    if (localAudioRef.current) {
      const stream = localAudioRef.current.srcObject;
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  return (
    <div style={{ textAlign: 'center', backgroundColor: 'black' }}>
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 20 }}>
        <p style={{ fontSize: 20, color: 'white' }}>{callStatus}</p>
      </div>
      
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* Buttons for End Call and Mute/Unmute */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', position: 'absolute', bottom: 20, width: '100%' }}>
          {/* End Call Icon */}
          <button
            onClick={endCall}
            style={{
              padding: '15px',
              backgroundColor: 'red',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            <FiPhoneOff color='white' size={30} />
          </button>

          {/* Mute/Unmute Icon */}
          <button
            onClick={toggleMute}
            style={{
              padding: '15px',
              backgroundColor: isMuted ? 'gray' : 'green',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            {isMuted ? <FiMicOff color='white' size={30}/> : <FiMic color='white' size={30}/>}
          </button>
        </div>
    </div>
  );
};

export default CallScreen;
