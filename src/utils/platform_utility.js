const isLinux = () => {
  return !!navigator.platform.match(/linux/i);
};

const isMac = () => {
  return !!navigator.platform.match(/mac/i);
};

const isWin = () => {
  return !!navigator.platform.match(/win/i);
};

const osType = () => {
  if (isMac()) {
    return 'mac';
  } else if (isWin()) {
    return 'win';
  } else {
    return 'linux';
  }
};

module.exports = {
  isLinux: isLinux,
  isMac: isMac,
  isWin: isWin,
  osType: osType
};
