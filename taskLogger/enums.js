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

const STEPS_REFERENCES_KEY = 'stepsReferences';
const LOGS_LOCATION = 'logs';

module.exports = {
    STATUS,
    STEPS_REFERENCES_KEY,
    LOGS_LOCATION
};
