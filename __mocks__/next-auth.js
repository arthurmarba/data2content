const getServerSession = jest.fn(async () => null);

module.exports = {
  getServerSession,
  default: { getServerSession },
};
