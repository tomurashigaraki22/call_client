import React, { useState, useEffect, useRef } from 'react';
import { FaPhone, FaMicrophone, FaPhoneSlash } from 'react-icons/fa';
import Peer from 'peerjs';

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState('Ringing'); // Call status: 'Ringing' or 'In Call'
  const [isMuted, setIsMuted] = useState(false); // Mute status
  const [timer, setTimer] = useState(0); // Timer state in seconds
  const [intervalId, setIntervalId] = useState(null); // Timer interval ID to clear it when needed
  const [callDetails, setCallDetails] = useState(null); // To store call details (e.g., peerId)
  const [peer, setPeer] = useState(null); // PeerJS instance
  const [peerId, setPeerId] = useState(null); // Local peer ID
  const [remoteStream, setRemoteStream] = useState(null); // Remote stream for audio
  const localAudioRef = useRef(null); // For local audio element
  const remoteAudioRef = useRef(null); // For remote audio element

  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');
  const driverId = urlParams.get('driverId');
  
  // Use first 4 characters of userId and driverId as peerIds
  const localPeerId = driverId?.slice(0, 4);
  const remotePeerId = userId?.slice(0, 4);

  // Set up PeerJS and WebRTC connection
  useEffect(() => {
    // Initialize PeerJS instance
    const newPeer = new Peer(localPeerId);
    setPeer(newPeer);

    // Generate local peer ID
    newPeer.on('open', (id) => {
      setPeerId(id); // Set the local peer ID
      console.log('My peer ID is: ', id);
    });

    // Handle incoming call
    newPeer.on('call', (call) => {
      console.log('Incoming call...');
      setCallStatus('Ringing');
      setCallDetails(call);
    });

    // Handle peer connection events
    newPeer.on('connection', (conn) => {
      console.log('Peer connected: ', conn);
    });

    // Cleanup on unmount
    return () => {
      if (newPeer) {
        newPeer.destroy();
      }
    };
  }, []);

  // Start the timer when call status is 'In Call'
  useEffect(() => {
    if (callStatus === 'In Call') {
      const id = setInterval(() => {
        setTimer((prev) => prev + 1); // Increase the timer every second
      }, 1000);
      setIntervalId(id);
    }

    // Cleanup interval when call ends
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [callStatus]);

  // Format the timer into minutes:seconds format
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${minutes}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Handle mute button click
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (localAudioRef.current && localAudioRef.current.srcObject) {
      localAudioRef.current.srcObject.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  };

  // Handle end call button click
  const endCall = () => {
    setCallStatus('Ended');
    if (peer && callDetails) {
      callDetails.close(); // Close the call
    }
    clearInterval(intervalId); // Clear the timer
  };

  // Handle accept call button click
  const acceptCall = () => {
    if (callDetails) {
      const { peer: callerId } = callDetails;
      callDetails.answer(localAudioRef.current.srcObject); // Answer the incoming call with local audio

      // Set up remote stream
      callDetails.on('stream', (stream) => {
        setRemoteStream(stream); // Set the remote audio stream
        remoteAudioRef.current.srcObject = stream;
      });

      setCallStatus('In Call');
    }
  };

  // Start the call when initiating a call (e.g., dial button press)
  const startCall = (remotePeerId) => {
    navigator.mediaDevices.getUserMedia({ audio: true }) // Only audio
      .then((stream) => {
        // Set local audio stream
        localAudioRef.current.srcObject = stream;

        // Make the call
        const call = peer.call(remotePeerId, stream);
        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream); // Set the remote audio stream
          remoteAudioRef.current.srcObject = remoteStream;
        });

        setCallStatus('In Call');
      })
      .catch((err) => {
        alert(`Error accessing media: ${err}`)

        console.error('Error accessing media devices: ', err);
      });
  };

  return (
    <div className="flex flex-col justify-between h-screen bg-blue-600 text-white p-4">
      <div className="flex flex-1 justify-center items-center">
        <div className="text-center">
          <div className="text-4xl font-bold mb-4">{callStatus}</div>
          {callStatus === 'In Call' && (
            <div className="text-2xl font-semibold">{formatTime(timer)}</div>
          )}
        </div>
      </div>

      <div className="flex justify-center space-x-8 mb-4">
        {callStatus === 'Ringing' && (
          <button onClick={acceptCall} className="p-4 bg-green-600 rounded-full shadow-lg">
            <FaPhone size={30} />
          </button>
        )}
        {callStatus === 'In Call' && (
          <>
            <button onClick={toggleMute} className="p-4 bg-yellow-600 rounded-full shadow-lg">
              <FaMicrophone size={30} className={isMuted ? 'opacity-50' : ''} />
            </button>
            <button onClick={endCall} className="p-4 bg-red-600 rounded-full shadow-lg">
              <FaPhoneSlash size={30} />
            </button>
          </>
        )}
      </div>

      <div className="flex justify-center space-x-4">
        <audio ref={localAudioRef} autoPlay muted className="w-0 h-0" />
        {remoteStream && (
          <audio ref={remoteAudioRef} autoPlay className="w-0 h-0" />
        )}
      </div>

      {localPeerId === driverId.slice(0, 4)  && (
        <div className="flex justify-center mt-4">
          <button onClick={() => startCall(remotePeerId)} className="p-4 bg-blue-500 rounded-full shadow-lg">
            Start Call
          </button>
        </div>
      )}
    </div>
  );
};

export default CallScreen;
