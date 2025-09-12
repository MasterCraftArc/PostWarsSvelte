import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CommentActivityForm from '../../src/lib/components/CommentActivityForm.svelte';

// Mock the API endpoint
global.fetch = vi.fn();

describe('Comment Activity Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('CommentActivityForm Component', () => {
    it('should render comment activity submission form', () => {
      // This test will fail because component doesn't exist yet
      const { getByText, getByLabelText } = render(CommentActivityForm);
      
      expect(getByText('💬 Log Comment Activity')).toBeInTheDocument();
      expect(getByLabelText('LinkedIn Post URL')).toBeInTheDocument();
      expect(getByText('Log Comment (+2 points)')).toBeInTheDocument();
    });

    it('should validate LinkedIn URL format', async () => {
      const { getByLabelText, getByText, getByRole } = render(CommentActivityForm);
      
      const urlInput = getByLabelText('LinkedIn Post URL');
      const submitButton = getByText('Log Comment (+2 points)');
      
      // Test invalid URL
      await urlInput.value = 'https://invalid-url.com';
      await submitButton.click();
      
      expect(getByText('Invalid LinkedIn post URL format')).toBeInTheDocument();
    });

    it('should submit valid comment activity and show success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          points_awarded: 2,
          message: 'Comment activity logged! You earned 2 points.' 
        })
      });

      const { getByLabelText, getByText } = render(CommentActivityForm);
      
      const urlInput = getByLabelText('LinkedIn Post URL');
      const submitButton = getByText('Log Comment (+2 points)');
      
      await urlInput.value = 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd';
      await submitButton.click();
      
      expect(global.fetch).toHaveBeenCalledWith('/api/comment-activities/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPostUrl: 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd'
        })
      });
      
      // Should show success message
      expect(getByText('Comment activity logged! You earned 2 points.')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ 
          error: 'You have already logged activity for this post' 
        })
      });

      const { getByLabelText, getByText } = render(CommentActivityForm);
      
      const urlInput = getByLabelText('LinkedIn Post URL');
      const submitButton = getByText('Log Comment (+2 points)');
      
      await urlInput.value = 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd';
      await submitButton.click();
      
      expect(getByText('You have already logged activity for this post')).toBeInTheDocument();
    });

    it('should emit success event when activity is logged', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          points_awarded: 2,
          activity: { id: 'test-id' }
        })
      });

      const mockEventHandler = vi.fn();
      const { getByLabelText, getByText, component } = render(CommentActivityForm);
      
      component.$on('success', mockEventHandler);
      
      const urlInput = getByLabelText('LinkedIn Post URL');
      const submitButton = getByText('Log Comment (+2 points)');
      
      await urlInput.value = 'https://www.linkedin.com/posts/john-doe_test-activity-1234567890-abcd';
      await submitButton.click();
      
      expect(mockEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            success: true,
            points_awarded: 2
          })
        })
      );
    });
  });
});