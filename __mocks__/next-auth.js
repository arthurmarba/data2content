const getServerSession = jest.fn(async () => null);
const NextAuth = jest.fn(() => async () => ({ status: 200 }));

NextAuth.getServerSession = getServerSession;

module.exports = {
  __esModule: true,
  default: NextAuth,
  getServerSession,
};
