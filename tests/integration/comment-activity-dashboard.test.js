import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../../src/routes/api/dashboard/+server.js';

// Mock Supabase Admin  
vi.mock('../../src/lib/supabase-node.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { 
              id: 'test-user-id',
              name: 'Test User',
              totalScore: 100,
              currentStreak: 5,
              bestStreak: 10
            }, 
            error: null 
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null }))
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({ data: [], error: null }))
          }))
        })),
        count: 'exact',
        head: true
      })),
      rpc: vi.fn(() => ({ data: null, error: 'RPC failed' }))
    }))
  }
}));

// Mock auth helpers
vi.mock('../../src/lib/auth-helpers.js', () => ({
  getAuthenticatedUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' }))
}));

describe('Comment Activity Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard API with Comment Activities', () => {
    it('should include comment activities in dashboard data', async () => {
      // Mock dashboard data with comment activities
      const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');
      
      // Mock comment activities query
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'comment_activities') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    data: [
                      {
                        id: 'comment-1',
                        target_post_url: 'https://www.linkedin.com/posts/test-post',
                        points_awarded: 2,
                        created_at: '2024-01-01T00:00:00Z'
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'test-user-id', totalScore: 100 }, error: null })),
              order: vi.fn(() => ({ data: [], error: null })),
              in: vi.fn(() => ({ order: vi.fn(() => ({ data: [], error: null })) }))
            })),
            count: 'exact',
            head: true
          })),
          rpc: vi.fn(() => ({ data: null, error: 'RPC failed' }))
        };
      });

      const mockEvent = {
        locals: { user: { id: 'test-user-id' } }
      };

      const response = await GET(mockEvent);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.recentPosts).toBeDefined();
      
      // Should include comment activities in posts
      const commentActivity = result.recentPosts.find(post => post.type === 'comment_activity');
      expect(commentActivity).toBeDefined();
      expect(commentActivity.content).toBe('💬 Commented on LinkedIn post');
      expect(commentActivity.totalScore).toBe(2);
    });

    it('should display comment activities with correct format', async () => {
      const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');
      
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'comment_activities') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    data: [
                      {
                        id: 'comment-1',
                        target_post_url: 'https://www.linkedin.com/posts/test-post',
                        points_awarded: 2,
                        created_at: '2024-01-01T00:00:00Z'
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'test-user-id', totalScore: 100 }, error: null })),
              order: vi.fn(() => ({ data: [], error: null })),
              in: vi.fn(() => ({ order: vi.fn(() => ({ data: [], error: null })) }))
            })),
            count: 'exact',
            head: true
          })),
          rpc: vi.fn(() => ({ data: null, error: 'RPC failed' }))
        };
      });

      const mockEvent = {
        locals: { user: { id: 'test-user-id' } }
      };

      const response = await GET(mockEvent);
      const result = await response.json();

      const commentActivity = result.recentPosts.find(post => post.type === 'comment_activity');
      
      expect(commentActivity.reactions).toBe('N/A');
      expect(commentActivity.comments).toBe('N/A'); 
      expect(commentActivity.reposts).toBe('N/A');
      expect(commentActivity.url).toBe('https://www.linkedin.com/posts/test-post');
    });
  });
});