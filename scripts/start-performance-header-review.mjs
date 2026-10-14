// Reuse the established synthetic read-only actual-app adapter. All API calls
// stay on localhost; saving, issuance and hosted connections are unavailable.
import './start-database-retrieval-review.mjs';
console.log('Header review: http://localhost:3000/manpower-reporting?performancePreview=active');
console.log('Frozen seven-day boundary: ?performancePreview=expired (or before).');
