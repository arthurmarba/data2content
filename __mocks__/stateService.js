const asyncStub = jest.fn(async () => ({}));

module.exports = {
  fetchDialogueState: asyncStub,
  saveDialogueState: asyncStub,
  deleteDialogueState: asyncStub,
  appendMessageToHistory: asyncStub,
  getConversationHistory: jest.fn(async () => []),
  setConversationHistory: jest.fn(async () => undefined),
  getDialogueState: jest.fn(async () => ({})),
  updateDialogueState: jest.fn(async () => undefined),
  createThread: jest.fn(async () => ({ _id: 'thread1' })),
  persistMessage: jest.fn(async () => 'message1'),
  generateThreadTitle: jest.fn(async () => undefined),
  getFromCache: jest.fn(async () => null),
  setInCache: jest.fn(async () => undefined),
  deleteFromCache: jest.fn(async () => undefined),
  default: {},
};
