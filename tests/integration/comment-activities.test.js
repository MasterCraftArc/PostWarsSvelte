import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../../src/routes/api/comment-activities/submit/+server.js';

// Mock Supabase Admin
vi.mock('../../src/lib/supabase-node.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: { id: 'test-id', points_awarded: 2 }, 
            error: null 
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null }))
          }))
        }))
      }))
    }))
  }
}));

// Mock gamification functions
vi.mock('../../src/lib/gamification.js', () => ({
  calculateCommentActivityScore: vi.fn(() => 2),
  updateUserStats: vi.fn(() => Promise.resolve())
}));

describe('Comment Activities API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/comment-activities/submit', () => {
    it('should create comment activity and return points', async () => {
      const mockRequest = {
        json: vi.fn(() => Promise.resolve({
          targetPostUrl: 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd'
        }))
      };

      const mockLocals = {
        user: { id: 'test-user-id' }
      };

      // This test will fail because the endpoint doesn't exist yet
      const response = await POST({ request: mockRequest, locals: mockLocals });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.points_awarded).toBe(2);
    });

    it('should validate LinkedIn URL format', async () => {
      const mockRequest = {
        json: vi.fn(() => Promise.resolve({
          targetPostUrl: 'https://invalid-url.com'
        }))
      };

      const mockLocals = {
        user: { id: 'test-user-id' }
      };

      const response = await POST({ request: mockRequest, locals: mockLocals });
      
      expect(response.status).toBe(400);
    });

    it('should prevent duplicate submissions', async () => {
      // Mock existing submission
      const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');
      
      // Reset the mock to return existing data for duplicate check
      supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: 'existing-id' },
                error: null
              }))
            }))
          }))
        }))
      });

      const mockRequest = {
        json: vi.fn(() => Promise.resolve({
          targetPostUrl: 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd'
        }))
      };

      const mockLocals = {
        user: { id: 'test-user-id' }
      };

      const response = await POST({ request: mockRequest, locals: mockLocals });
      
      expect(response.status).toBe(409);
    });
  });
});