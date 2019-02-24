const STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    ERROR: 'error',
    SKIPPED: 'skipped',
    PENDING_APPROVAL: 'pending-approval',
    APPROVED: 'approved',
    DENIED: 'denied',
    TERMINATING: 'terminating',
    TERMINATED: 'terminated'
};

const TYPES = {
    FIREBASE: 'firebase',
    REDIS: 'redis'
};

const VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private'
};

module.exports = {
    STATUS,
    TYPES,
    VISIBILITY
};
