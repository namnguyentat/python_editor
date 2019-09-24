const isLinux = navigator.userAgent.indexOf('Linux') !== -1;
const isMacintosh = navigator.userAgent.indexOf('Macintosh') !== -1;
const isWindows = navigator.userAgent.indexOf('Windows') !== -1;
const OS = isMacintosh ? 'macintosh' : isWindows ? 'windows' : 'linux';

module.exports = {
  isLinux: isLinux,
  isMacintosh: isMacintosh,
  isWindows: isWindows,
  OS: OS
};
