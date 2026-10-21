const assert = require('node:assert/strict');
const { test } = require('node:test');
const { groupConversationThreads, threadKind, threadTitle } = require('../features/conversations/threads.ts');

function conversation(id, extra = {}) {
  return {
    id, applicationId: null, booking: null, job: null, unreadCount: 2,
    createdAt: '2026-10-21T10:00:00Z', lastMessageAt: null, lastMessage: null, me: 'poster',
    counterpart: { id: 'teacher', userId: 'teacher-user', role: 'teacher', name: 'Alex', imageUrl: null },
    participants: { instructor: { id: 'teacher' }, poster: { id: 'school' } },
    ...extra,
  };
}

test('only General and Jobs exist; invitations do not duplicate chats or unread counts', () => {
  const general = conversation('general');
  const application = conversation('application', { applicationId: 'app', job: { id: 'job', title: 'Maths' } });
  const booking = conversation('booking', { booking: { id: 'booking-id', applicationId: 'app', status: 'CONFIRMED' }, job: { id: 'job', title: 'Maths' } });
  const invitation = { id: 'invite', job: { id: 'job' }, instructor: { id: 'teacher' }, institution: { id: 'school' }, createdAt: '2026-10-20T10:00:00Z' };
  const [group] = groupConversationThreads([general, application, booking, general], [invitation, invitation]);
  assert.equal(group.threads.length, 3);
  assert.equal(group.unreadCount, 6);
  assert.equal(group.invitations.length, 1);
  assert.deepEqual([...new Set(group.threads.map(threadKind))].sort(), ['General', 'Jobs']);
  assert.equal(threadTitle(group.threads.find(t => t.key === 'booking')), 'Booking · Maths');
  assert.equal(threadTitle(group.threads.find(t => t.key === 'application')), 'Application · Maths');
});

test('invitations stay with the exact school and teacher, never matched by name', () => {
  const a = conversation('a');
  const b = conversation('b', { counterpart: { ...a.counterpart, id: 'teacher-2', userId: 'user-2' }, participants: { ...a.participants, instructor: { id: 'teacher-2' } } });
  const invitation = { id: 'invite', instructor: { id: 'teacher' }, institution: { id: 'another-school' }, createdAt: '2026-10-20' };
  const groups = groupConversationThreads([a, b], [invitation]);
  assert.equal(groups.length, 2);
  assert.ok(groups.every(g => g.invitations.length === 0));
});

test('each booking remains separate and newest bookings sort first under Jobs', () => {
  const older = conversation('older', { booking: { id: 'b1' }, createdAt: '2026-10-20' });
  const newer = conversation('newer', { booking: { id: 'b2' }, createdAt: '2026-10-21' });
  const [group] = groupConversationThreads([older, newer, conversation('general')]);
  assert.deepEqual(group.threads.map(t => t.key), ['newer', 'older', 'general']);
});
