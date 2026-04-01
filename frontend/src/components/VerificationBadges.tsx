import { FC } from 'react';
import { VerificationStatus } from '../types';
import './VerificationBadges.css';

interface VerificationBadgesProps {
  status: VerificationStatus | null;
  loading?: boolean;
  compact?: boolean;
}

export const VerificationBadges: FC<VerificationBadgesProps> = ({
  status,
  loading = false,
  compact = false
}) => {
  if (loading) {
    return (
      <div className={`verification-badges ${compact ? 'compact' : ''}`}>
        <span className="badge badge-loading">...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={`verification-badges ${compact ? 'compact' : ''}`}>
        <span className="badge badge-unknown" title="Status unknown">?</span>
      </div>
    );
  }

  return (
    <div className={`verification-badges ${compact ? 'compact' : ''}`}>
      {/* Meilisearch status */}
      <span
        className={`badge ${status.inMeilisearch ? 'badge-success' : 'badge-error'}`}
        title={status.inMeilisearch ? 'Indexed in Meilisearch' : 'Not in Meilisearch'}
      >
        {compact ? 'MS' : 'Meilisearch'} {status.inMeilisearch ? '✓' : '✗'}
      </span>

      {/* Gemini status */}
      <span
        className={`badge ${status.inGemini ? 'badge-success' : 'badge-warning'}`}
        title={status.inGemini ? 'Synced to Gemini' : 'Not in Gemini'}
      >
        {compact ? 'AI' : 'Gemini'} {status.inGemini ? '✓' : '✗'}
      </span>

      {/* Hash match status */}
      <span
        className={`badge ${status.hashMatches ? 'badge-success' : 'badge-warning'}`}
        title={status.hashMatches ? 'Hash matches (up to date)' : 'Hash mismatch (needs resync)'}
      >
        {compact ? '#' : 'Hash'} {status.hashMatches ? '✓' : '⚠'}
      </span>

      {/* Image count */}
      {!compact && (
        <span
          className={`badge ${status.imageCount > 0 ? 'badge-info' : 'badge-warning'}`}
          title={`${status.imageCount} images`}
        >
          {status.imageCount} img
        </span>
      )}
    </div>
  );
};
