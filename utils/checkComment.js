const isValidReview = (comment) => {
  /* eslint no-restricted-syntax: ["error", "FunctionExpression", "WithStatement", "BinaryExpression[operator='in']"] */
  const BadWords = ['fuck', 'fucker', 'trash'];
  const cmt = String(comment).toLowerCase();
  for (const word of BadWords) {
    if (cmt.indexOf(word) !== -1) return false;
  }
  return true;
};

module.exports = isValidReview;
