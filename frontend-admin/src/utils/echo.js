// Mock Echo for local development if Reverb is not ready
const mockChannel = {
    listen: function() { return this; },
    notification: function() { return this; },
    listenForWhisper: function() { return this; },
    whisper: function() { return this; },
};

const mockEcho = {
    private: () => mockChannel,
    channel: () => mockChannel,
    leave: () => {},
    disconnect: () => {},
};

export function getEcho() {
    return mockEcho;
}

export function destroyEcho() {
}

export default mockEcho;
