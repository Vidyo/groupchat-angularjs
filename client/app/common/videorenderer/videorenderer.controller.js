class VideoRendererController {
  constructor($timeout, $rootScope) {
    this.$timeout = $timeout;
    this.$rootScope = $rootScope;
    this.isLoading = true;
    this.isConnected = false;
    this.roomId = "";
    this.isConnectionError = false;
    this.listenEvent();
    this.listenConnectionChangeOrder();
    this.loadVidyoClientLibrary();
  }

  listenConnectionChangeOrder() {
    this.$rootScope.$on('connection:on', () => {
      if (!this.$rootScope.vidyoConnector) {
        this.loadVidyoClientLibrary();
      } else {
        this.connectVidyo(this.$rootScope.vidyoConnector);
      }
    });

    this.$rootScope.$on('connection:off', () => {
      this.disconnectVidyo(this.$rootScope.vidyoConnector);
    });

    this.$rootScope.$on('micMute:on', () => {
      this.$rootScope.vidyoConnector.SetMicrophonePrivacy(true);
    });

    this.$rootScope.$on('micMute:off', () => {
      this.$rootScope.vidyoConnector.SetMicrophonePrivacy(false);
    });

    this.$rootScope.$on('cameraMute:on', () => {
      this.$rootScope.vidyoConnector.SetCameraPrivacy(true);
    });

    this.$rootScope.$on('cameraMute:off', () => {
      this.$rootScope.vidyoConnector.SetCameraPrivacy(false);
    });
  }

  listenEvent() {
    document.addEventListener('vidyoclient:ready', (e) => {
      this.renderVideo(e.detail);
    });
  }

  renderVideo(VC) {
    this.$timeout(() => {
      VC.CreateVidyoConnector({
        viewId: "renderer",                            // Div ID where the composited video will be rendered, see VidyoConnector.html
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 16,                        // Maximum number of participants
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
        logFileName:"",
        userData:""
      }).then((vidyoConnector) => {
        this.$rootScope.vidyoConnector = vidyoConnector;
        this.connectVidyo(vidyoConnector);
      }).catch(() => {
        console.error("CreateVidyoConnector Failed");
        this.isLoading = false;
        this.isConnectionError = true;
      });
    });
  }

  loadVidyoClientLibrary() {
    var webrtc = true;
    var plugin = false;

    var userAgent = navigator.userAgent || navigator.vendor || window.opera;
    var isFirefox = userAgent.indexOf("Firefox") != -1;
		var isChrome = userAgent.indexOf("Chrome") != -1;

		if (isChrome || isFirefox) {
			/* Supports WebRTC */
			webrtc = true;
      plugin = false;
      console.log('Either chrome or Firefox');
		} else  {
			plugin = true;
      webrtc = false;
      console.log('Not chrome or Firefox');
		}

		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = 'https://static.vidyo.io/latest/javascript/VidyoClient/VidyoClient.js?onload=onVidyoClientLoaded&webrtc=' + webrtc + '&plugin=' + plugin;
		document.getElementsByTagName('head')[0].appendChild(script);
	}

  disconnectVidyo(vidyoConnector) {
    vidyoConnector.Disconnect();
  }

  connectVidyo(vidyoConnector) {
    console.log('passed in token',this.$rootScope.user.token);
    console.log('passed in user name',this.$rootScope.user.name);
    console.log('passed in room id',this.$rootScope.user.roomId);

    this.roomId = this.$rootScope.user.roomId || 'demoRoom';
    vidyoConnector.Connect({
      host: "prod.vidyo.io",
      token: this.$rootScope.user.token,
      displayName: this.$rootScope.user.name,
      resourceId: this.$rootScope.user.roomId,

      onSuccess: () => {
        // Connected
        console.log('connected!');
        this.isConnected = true;
        this.$rootScope.$broadcast('connectedStatus', { isConnected: true });
      },
      onFailure: (reason) => {
        // Failed
        this.isConnectionError = true;
        console.log('failed! The reason: ', reason);
      },
      onDisconnected: (reason) => {
        // Disconnected
        this.isConnected = false;
        console.log('disconnected! Reason: ', reason);
        this.$rootScope.$broadcast('connectedStatus', { isConnected: false });
      }
    }).then((status) => {
      this.isLoading = false;
      if (status) {
        this.handlePaticipants(vidyoConnector);
        this.receiveMessage(vidyoConnector);
      } else {
        this.isConnectionError = true;
        console.error("ConnectCall Failed");
      }
    }).catch(() => {
      this.isConnectionError = true;
      this.isLoading = false;
      console.error("ConnectCall Failed");
    });
  }

  receiveMessage(vidyoConnector) {
    vidyoConnector.RegisterMessageEventListener({
      onChatMessageReceived: (participant, chatMessage) => {
        this.onSendMessage({ id: participant.id, name: participant.name, content: chatMessage.body });
      }
    }).then(() => {
      console.log("RegisterParticipantEventListener Success");
    }).catch(() => {
      console.err("RegisterParticipantEventListener Failed");
    });
  }

  handlePaticipants(vidyoConnector) {
    vidyoConnector.RegisterParticipantEventListener(
      {
        onJoined: (participant) => {
          console.log('Joined', participant);
          this.onAddUser({ id:participant.id, name:participant.name });
        },
        onLeft: (participant) => {
          console.log('Left', participant);
          this.onRemoveUser({ id:participant.id, name:participant.name });
        },
        onDynamicChanged: (participants, cameras) => { /* Ordered array of participants according to rank */ },
        onLoudestChanged: (participant, audioOnly) => { /* Current loudest speaker */ }
      }
    ).then(() => {
      console.log("RegisterParticipantEventListener Success");
    }).catch(() => {
      console.err("RegisterParticipantEventListener Failed");
    });
  }
}

VideoRendererController.$inject = ['$timeout', '$rootScope'];

export default VideoRendererController;
