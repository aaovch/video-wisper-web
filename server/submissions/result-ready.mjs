export function passedReview(draft) {
  const review = draft?.review;
  return review?.pass === true && Array.isArray(review.issues) && review.issues.length === 0;
}

export function hasReadableResult(row) {
  return Boolean(row?.draft && (row.state === 'published' || (row.state === 'review' && passedReview(row.draft))));
}
