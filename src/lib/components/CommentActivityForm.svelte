<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let targetPostUrl = '';
  let isSubmitting = false;
  let error = '';
  let successMessage = '';
  
  function validateLinkedInUrl(url) {
    const linkedinUrlPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
    return linkedinUrlPattern.test(url);
  }
  
  async function submitActivity() {
    if (!targetPostUrl.trim()) {
      error = 'LinkedIn post URL is required';
      return;
    }
    
    if (!validateLinkedInUrl(targetPostUrl.trim())) {
      error = 'Invalid LinkedIn post URL format';
      return;
    }
    
    isSubmitting = true;
    error = '';
    successMessage = '';
    
    try {
      const response = await fetch('/api/comment-activities/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPostUrl: targetPostUrl.trim()
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        successMessage = result.message || `Comment activity logged! You earned ${result.points_awarded} points.`;
        dispatch('success', result);
        targetPostUrl = '';
      } else {
        error = result.error || 'Failed to submit comment activity';
      }
    } catch (e) {
      error = 'Failed to submit comment activity';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="comment-activity-form bg-white rounded-lg border p-6 mb-6">
  <h3 class="text-lg font-semibold mb-4 flex items-center">
    💬 Log Comment Activity
  </h3>
  
  <p class="text-sm text-gray-600 mb-4">
    Earn 0.5 base points (plus streak bonus) for each LinkedIn post you comment on. Paste the URL of the post you commented on below.
  </p>
  
  <div class="space-y-4">
    <div>
      <label for="post-url" class="block text-sm font-medium text-gray-700 mb-2">
        LinkedIn Post URL
      </label>
      <input 
        id="post-url"
        type="url" 
        bind:value={targetPostUrl}
        placeholder="https://www.linkedin.com/posts/username-activity-..."
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isSubmitting}
      />
    </div>
    
    {#if error}
      <div class="text-red-600 text-sm bg-red-50 p-2 rounded">
        {error}
      </div>
    {/if}
    
    {#if successMessage}
      <div class="text-green-600 text-sm bg-green-50 p-2 rounded">
        {successMessage}
      </div>
    {/if}
    
    <button 
      on:click={submitActivity}
      disabled={isSubmitting || !targetPostUrl.trim()}
      class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isSubmitting ? 'Submitting...' : 'Log Comment Activity'}
    </button>
  </div>
</div>

<style>
  .comment-activity-form {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style>