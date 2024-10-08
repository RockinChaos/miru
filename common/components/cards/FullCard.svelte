<script>
  import { getContext } from 'svelte'
  import { formatMap, statusColorMap } from '@/modules/anime.js'
  import { click } from '@/modules/click.js'
  import { countdown } from '@/modules/util.js'
  import { page } from '@/App.svelte'
  import AudioLabel from '@/views/ViewAnime/AudioLabel.svelte'
  import { anilistClient } from "@/modules/anilist"
  import Helper from "@/modules/helper.js"
  /** @type {import('@/modules/al.d.ts').Media} */
  export let media
  export let variables = null

  const view = getContext('view')
  function viewMedia () {
    $view = media
  }
</script>

<div class='d-flex px-20 py-10 position-relative justify-content-center' use:click={viewMedia}>
  <div class='card m-0 p-0 overflow-hidden pointer content-visibility-auto full-card' class:opacity-half={variables?.continueWatching && Helper.isMalAuth() && media?.status !== 'FINISHED' && media?.mediaListEntry?.progress >= media?.nextAiringEpisode?.episode - 1}
    style:--color={media.coverImage.color || '#1890ff'}>
    <div class='row h-full'>
      <div class='col-4 img-col d-inline-block position-relative'>
        <img loading='lazy' src={media.coverImage.extraLarge || ''} alt='cover' class='cover-img w-full h-full' />
        <AudioLabel {media} />
      </div>
      <div class='col h-full card-grid'>
        <div class='px-15 py-10 bg-very-dark'>
          <h5 class='m-0 text-white text-capitalize font-weight-bold'>
            {#if media.mediaListEntry?.status}
              <div style:--statusColor={statusColorMap[media.mediaListEntry.status]} class='list-status-circle d-inline-flex overflow-hidden mr-5' title={media.mediaListEntry.status} />
            {/if}
            {anilistClient.title(media)}
          </h5>
          {#if $page === 'schedule'}
            <div class='py-5'>
              {#if media.airingSchedule?.nodes?.[0]?.airingAt}
                Episode {media.airingSchedule.nodes[0].episode } in
                <span class='font-weight-bold text-light'>
                  {countdown(media.airingSchedule.nodes[0].airingAt - Date.now() / 1000)}
                </span>
              {:else}
                &nbsp;
              {/if}
            </div>
          {/if}
          <p class='details text-muted m-0 text-capitalize d-flex flex-wrap'>
            <span class='text-nowrap d-flex align-items-center'>
              {#if media.format === 'TV'}
                TV Show
              {:else if media.format}
                {formatMap[media.format]}
              {/if}
            </span>
            {#if media.episodes && media.episodes !== 1}
              <span class='text-nowrap d-flex align-items-center'>
                {#if media.mediaListEntry?.status === 'CURRENT' && media.mediaListEntry?.progress }
                  {media.mediaListEntry.progress} / {media.episodes} Episodes
                {:else}
                  {media.episodes} Episodes
                {/if}
              </span>
            {:else if media.duration}
              <span class='text-nowrap d-flex align-items-center'>{media.duration + ' Minutes'}</span>
            {/if}
            <span class='text-nowrap d-flex align-items-center'>
              <AudioLabel {media} banner={true}/>
            </span>
            {#if media.isAdult}
              <span class='text-nowrap d-flex align-items-center'>
                Rated 18+
              </span>
            {/if}
            {#if media.status}
              <span class='text-nowrap d-flex align-items-center'>{media.status?.toLowerCase().replace(/_/g, ' ')}</span>
            {/if}
          </p>
          <p class='details text-muted m-0 text-capitalize d-flex flex-wrap'>
            {#if media.season || media.seasonYear}
              <span class='text-nowrap d-flex align-items-center'>
                {[media.season?.toLowerCase(), media.seasonYear].filter(s => s).join(' ')}
              </span>
            {/if}
            {#if media.averageScore}
              <span class='text-nowrap d-flex align-items-center'>{media.averageScore + '%'} Rating</span>
              {#if media.stats?.scoreDistribution}
                <span class='text-nowrap d-flex align-items-center'>{anilistClient.reviews(media)} Reviews</span>
              {/if}
            {/if}
          </p>
        </div>
        {#if media.description}
          <div class='overflow-y-auto px-15 pb-5 bg-very-dark card-desc pre-wrap'>
            {media.description?.replace(/<[^>]*>/g, '') || ''}
          </div>
        {/if}
        {#if media.genres.length}
          <div class='px-15 pb-10 pt-5 genres'>
            {#each media.genres.slice(0, 3) as genre}
              <span class='badge badge-pill badge-color text-dark mt-5 mr-5 font-weight-bold'>{genre}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
.pre-wrap {
  white-space: pre-wrap
}
.opacity-half {
  opacity: 30%;
}
.details {
  font-size: 1.3rem;
}
.details > span:not(:last-child)::after {
  content: '•';
  padding: .5rem;
  font-size: .6rem;
  align-self: center;
  white-space: normal;
}
.card {
  animation: 0.3s ease 0s 1 load-in;
  width: 52rem !important;
  height: 27rem !important;
  box-shadow: rgba(0, 4, 12, 0.3) 0px 7px 15px, rgba(0, 4, 12, 0.05) 0px 4px 4px;
  contain-intrinsic-height: 27rem;
  transition: transform 0.2s ease;
}
.card:hover{
  transform: scale(1.05);
}
.card-grid {
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.badge-color {
  background-color: var(--color) !important;
  border-color: var(--color) !important;
}
.cover-img {
  background-color: var(--color) !important;
}
.list-status-circle {
  background: var(--statusColor);
  height: 1.1rem;
  width: 1.1rem;
  border-radius: 50%;
}
</style>
