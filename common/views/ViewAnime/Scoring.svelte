<script>
  import { anilistClient, codes } from '@/modules/anilist.js'
  import { click } from '@/modules/click.js'
  import { writable } from 'svelte/store'
  import { toast } from 'svelte-sonner'
  import Helper from '@/modules/helper.js'

  /** @type {import('@/modules/al.d.ts').Media} */
  export let media
  export let viewAnime = false
  export let previewAnime = false

  const showModal = writable(false)

  let modal

  let score = 0
  let status = 'NOT IN LIST'
  let episode = 0
  let totalEpisodes = '?'

  const scoreName = {
    10: '(Masterpiece)',
    9: '(Great)',
    8: '(Very Good)',
    7: '(Good)',
    6: '(Fine)',
    5: '(Average)',
    4: '(Bad)',
    3: '(Very bad)',
    2: '(Horrible)',
    1: '(Appalling)',
    0: 'Not Rated'
  }

  async function toggleModal (state) {
    showModal.set(!$showModal)
    if (state.save || state.delete) {
      await new Promise(resolve => setTimeout(resolve, 300)) // allows time for animation to play
      if (state.save) {
        saveChanges()
      } else if (state.delete) {
        deleteEntry()
      }
    } else {
      score = (media.mediaListEntry?.score ? media.mediaListEntry?.score : 0)
      status = (media.mediaListEntry?.status ? media.mediaListEntry?.status : 'NOT IN LIST')
      episode = (media.mediaListEntry?.progress ? media.mediaListEntry?.progress : 0)
      totalEpisodes = (media.episodes ? `${media.episodes}` : '?')
    }
  }

  async function deleteEntry() {
    score = 0
    episode = 0
    status = 'NOT IN LIST'
    if (media.mediaListEntry) {
      const res = await Helper.delete(media)
      const description = `${anilistClient.title(media)} has been deleted from your list.`
      if (res) {
        console.log('List Updated: ' + description)
        toast.warning('List Updated', {
          description,
          duration: 6000
        })
        media.mediaListEntry = undefined
      } else {
        const error = `\n${429} - ${codes[429]}`
        console.error('Failed to delete title from user list with: ' + description + error)
        toast.error('Failed to Delete Title', {
          description: description + error,
          duration: 9000
        })
      }
    }
  }

  async function saveChanges() {
    if (!status.includes('NOT IN LIST')) {
      const fuzzyDate = Helper.getFuzzyDate(media, status)
      const variables = {
              id: media.id,
              idMal: media.idMal,
              status,
              episode,
              score: Helper.isAniAuth() ? (score * 10) : score, // AniList score scale is out of 100, others use a scale of 10.
              repeat: media.mediaListEntry?.repeat || 0,
              lists: media.mediaListEntry?.customLists?.filter(list => list.enabled).map(list => list.name) || [],
              ...fuzzyDate
            }
      let res = await Helper.entry(media, variables)
      const description = `Title: ${anilistClient.title(media)}\nStatus: ${Helper.statusName[media.mediaListEntry.status]}\nEpisode: ${episode} / ${totalEpisodes}${score !== 0 ? `\nYour Score: ${score}` : ''}`
      if (res?.data?.SaveMediaListEntry) {
        console.log('List Updated: ' + description)
        toast.success('List Updated', {
          description,
          duration: 6000
        })
      } else {
        const error = `\n${429} - ${codes[429]}`
        console.error('Failed to update user list with: ' + description + error)
        toast.error('Failed to Update List', {
          description: description + error,
          duration: 9000
        })
      }
    } else {
       await deleteEntry()
    }
  }

  /**
   * @param {Event & { currentTarget: HTMLInputElement }} event
   */
  function handleEpisodes(event) {
    const enteredValue = event.currentTarget.value
    if (/^\d+$/.test(enteredValue)) {
      const maxEpisodes = media.episodes || (media.nextAiringEpisode?.episode - 1)
      if (parseInt(enteredValue) > maxEpisodes) {
        episode = maxEpisodes
      } else {
        episode = parseInt(enteredValue)
      }
    } else {
      episode = 0
    }
  }

  function handleClick({target}) {
    if (modal && !modal.contains(target) && target.id !== 'list-btn') {
      showModal.set(false)
      document.removeEventListener('click', handleClick, true)
    }
  }

  $: {
    if ($showModal) {
      document.addEventListener('click', handleClick, true)
    } else {
      document.removeEventListener('click', handleClick, true)
    }
  }
</script>

{#if Helper.isAuthorized()}
  <button type='button' id='list-btn' class='btn { viewAnime ? "bg-dark btn-lg font-size-20" : (previewAnime ? "btn-square" : "bg-dark-light") + " font-size-16" } btn-square ml-10 material-symbols-outlined shadow-none border-0' use:click={toggleModal}>
    { media.mediaListEntry ? 'border_color' : 'bookmark' }
  </button>
  <div bind:this={modal} class='modal scoring position-absolute bg-dark shadow-lg rounded-3 p-20 z-30 {$showModal ? "visible" : "invisible"} {!previewAnime && !viewAnime ? "banner w-auto h-auto" : (!previewAnime ? "viewAnime w-auto h-auto" : "previewAnime")}' use:click={() => {}}>
    <div class='d-flex justify-content-between align-items-center mb-2'>
      <h5 class='font-weight-bold'>List Editor</h5>
      <button type='button' class='btn btn-square mb-20 text-white font-size-24 font-weight-bold' use:click={toggleModal}>&times;</button>
    </div>
    <div class='modal-body'>
      <div class='form-group mb-15'>
        <label class='d-block mb-5' for='status'>Status</label>
        <select class='form-control bg-dark-light' id='status' bind:value={status}>
          <option value selected disabled hidden>Any</option>
          <option value='CURRENT'>Watching</option>
          <option value='PLANNING'>Planning</option>
          <option value='COMPLETED'>Completed</option>
          <option value='PAUSED'>Paused</option>
          <option value='DROPPED'>Dropped</option>
          <option value='REPEATING'>Rewatching</option>
        </select>
      </div>
      <div class='form-group'>
        <label class='d-block mb-5' for='episode'>Episode</label>
        <div class='d-flex'>
          <input class='form-control bg-dark-light w-full' type='number' id='episode' bind:value={episode} on:input={handleEpisodes} />
          <div>
            <span class='total-episodes position-absolute text-right pointer-events-none'>/ {totalEpisodes}</span>
          </div>
        </div>
      </div>
      <div class='form-group'>
        <label class='d-block mb-5' for='score'>Your Score</label>
        <input class='w-full p-2 bg-dark-light' type='range' id='score' min='0' max='10' bind:value={score} />
        <div class='d-flex justify-content-center'>
          {#if score !== 0}
            <span class='text-center mt-2 text-decoration-underline font-weight-bold'>{score}</span>
            <span class='ml-5'>/ 10</span>
          {/if}
          <span class='ml-5'>{scoreName[score]}</span>
        </div>
      </div>
    </div>
    <div class='d-flex justify-content-center'>
      {#if !status.includes('NOT IN LIST') && media.mediaListEntry}
        <button type='button' class='btn btn-delete btn-secondary text-dark mr-20 font-weight-bold shadow-none' use:click={() => toggleModal({ delete: true })}>Delete</button>
      {/if}
      <button type='button' class='btn btn-save btn-secondary text-dark font-weight-bold shadow-none' use:click={() => toggleModal({ save: true })}>Save</button>
    </div>
  </div>
{/if}

<style>
  .modal:global(.absolute-container) {
    left: -48% !important;
  }
  .btn-delete:hover {
    color: white !important;
    background: darkred !important;
  }
  .btn-save:hover {
    color: white !important;
    background: darkgreen !important;
  }
  .total-episodes {
    margin-top: 0.65rem;
    right: 4rem;
  }
  .previewAnime {
    top: 65%;
    margin-top: -26rem;
    width: 70%;
    left: 0.5rem;
    cursor: auto;
  }
  .viewAnime {
    top: auto;
    left: auto;
    margin-top: -1rem;
    margin-left: 4rem;
  }
  .banner {
    top: auto;
    left: auto;
    margin-top: 2rem;
    margin-left: 14.5rem;
  }
  .visible {
    animation: 0.3s ease 0s 1 load-in;
  }
  .invisible {
    animation: load-out 0.3s ease-out forwards;
  }
  @keyframes load-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes load-out {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
</style>