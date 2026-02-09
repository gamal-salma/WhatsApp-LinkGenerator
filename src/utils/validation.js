// E.164 format: + followed by 1-15 digits
const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const MAX_MESSAGE_LENGTH = 65536;

function isValidPhone(phone) {
  return typeof phone === 'string' && E164_REGEX.test(phone);
}

function isValidMessage(message) {
  return typeof message === 'string' && message.length <= MAX_MESSAGE_LENGTH;
}

module.exports = { isValidPhone, isValidMessage, MAX_MESSAGE_LENGTH };
