import { alToken, malToken, isAuthorized } from '@/modules/settings.js'
import { anilistClient, codes } from '@/modules/anilist.js'
import { malClient } from '@/modules/myanimelist.js'
import { malDubs } from "@/modules/animedubs.js"
import { toast } from 'svelte-sonner'
import Fuse from 'fuse.js'

export default class Helper {

  static statusName = {
    CURRENT: 'Watching',
    PLANNING: 'Planning',
    COMPLETED: 'Completed',
    PAUSED: 'Paused',
    DROPPED: 'Dropped',
    REPEATING: 'Rewatching'
  }

  static sortMap(sort) {
    switch(sort) {
      case 'UPDATED_TIME_DESC':
        return 'list_updated_at'
      case 'STARTED_ON_DESC':
        return 'list_start_date_nan' // doesn't exist, therefore we use custom logic.
      case 'FINISHED_ON_DESC':
        return 'list_finish_date_nan' // doesn't exist, therefore we use custom logic.
      case 'PROGRESS_DESC':
        return 'list_progress_nan' // doesn't exist, therefore we use custom logic.
      case 'USER_SCORE_DESC':
        return 'list_score'
    }
  }

  static statusMap(status) {
    switch(status) {
      // MyAnimeList to AniList
      case 'watching':
        return 'CURRENT'
      case 'rewatching':
        return 'REPEATING' // rewatching is determined by is_rewatching boolean (no individual list)
      case 'plan_to_watch':
        return 'PLANNING'
      case 'completed':
        return 'COMPLETED'
      case 'dropped':
        return 'DROPPED'
      case 'on_hold':
        return 'PAUSED'
        // AniList to MyAnimeList
      case 'CURRENT':
        return 'watching'
      case 'PLANNING':
        return 'plan_to_watch'
      case 'COMPLETED':
        return 'completed'
      case 'DROPPED':
        return 'dropped'
      case 'PAUSED':
        return 'on_hold'
      case 'REPEATING':
        return 'watching' // repeating is determined by is_rewatching boolean (no individual list)
    }
  }

  static airingMap(status) {
    switch(status) {
      case 'finished_airing':
        return 'FINISHED'
      case 'currently_airing':
        return 'RELEASING'
      case 'not_yet_aired':
        return 'NOT_YET_RELEASED'
    }
  }

  static getFuzzyDate(media, status) {
    const updatedDate = new Date()
    const fuzzyDate = {
      year: updatedDate.getFullYear(),
      month: updatedDate.getMonth() + 1,
      day: updatedDate.getDate()
    }
    const startedAt =  media.mediaListEntry?.startedAt?.year && media.mediaListEntry?.startedAt?.month && media.mediaListEntry?.startedAt?.day ? media.mediaListEntry.startedAt : (['CURRENT', 'REPEATING'].includes(status) ? fuzzyDate : undefined)
    const completedAt = media.mediaListEntry?.completedAt?.year && media.mediaListEntry?.completedAt?.month && media.mediaListEntry?.completedAt?.day ? media.mediaListEntry.completedAt : (status === 'COMPLETED' ? fuzzyDate : undefined)
    return {startedAt, completedAt}
  }

  static sanitiseObject (object = {}) {
    const safe = {}
    for (const [key, value] of Object.entries(object)) {
      if (value) safe[key] = value
    }
    return safe
  }

  static isAniAuth() {
    return alToken
  }

  static isMalAuth() {
    return malToken
  }

  static isAuthorized() {
    return isAuthorized()
  }

  static getClient() {
    return this.isAniAuth() ? anilistClient : malClient
  }

  static getUser() {
    return this.getClient().userID?.viewer?.data?.Viewer
  }

  static getUserAvatar() {
    if (anilistClient.userID?.viewer?.data?.Viewer) {
      return anilistClient.userID.viewer.data.Viewer.avatar.medium
    } else if (malClient.userID?.viewer?.data?.Viewer) {
      return malClient.userID.viewer.data.Viewer.picture
    }
  }

  static isUserSort(variables) {
    return ['UPDATED_TIME_DESC', 'STARTED_ON_DESC', 'FINISHED_ON_DESC', 'PROGRESS_DESC', 'USER_SCORE_DESC'].includes(variables?.sort)
  }

  static userLists(variables) {
    return (!this.isUserSort(variables) || variables.sort === 'UPDATED_TIME_DESC')
        ? this.getClient().userLists.value
        : this.getClient().getUserLists({sort: (this.isAniAuth() ? variables.sort : this.sortMap(variables.sort))})
  }

  static async entry(media, variables) {
    let res = await this.getClient().entry(variables)
    media.mediaListEntry = res.data.SaveMediaListEntry
    return res
  }

  static async delete(media) {
    return await this.getClient().delete((this.isAniAuth() ? {id: media.mediaListEntry.id} : {idMal: media.idMal}))
  }

  static matchTitle(media, phrase, keys) {
    if (!phrase) {
      return true
    }
    const options = {
      includeScore: true,
      threshold: 0.4,
      keys: keys
    }
    return new Fuse([media], options).search(phrase).length > 0
  }

  /*
   * This exists to fill in any queried AniList media with the user list media data from alternate authorizations.
   */
  static async fillEntry(media) {
    if (this.isMalAuth()) {
      const userLists = await malClient.userLists.value
      const malEntry = userLists.data.MediaList.find(({ node }) => node.id === media.idMal)
      if (malEntry) {
        const start_date = malEntry.node.my_list_status.start_date ? new Date(malEntry.node.my_list_status.start_date) : undefined
        const finish_date = malEntry.node.my_list_status.finish_date ? new Date(malEntry.node.my_list_status.finish_date) : undefined
        const startedAt = start_date ? {
          year: start_date.getFullYear(),
          month: start_date.getMonth() + 1,
          day: start_date.getDate()
        } : undefined
        const completedAt = finish_date ? {
          year: finish_date.getFullYear(),
          month: finish_date.getMonth() + 1,
          day: finish_date.getDate()
        } : undefined
        media.mediaListEntry = {
          id: media.id,
          progress: malEntry.node.my_list_status.num_episodes_watched,
          repeat: malEntry.node.my_list_status.number_times_rewatched,
          status: this.statusMap(malEntry.node.my_list_status?.is_rewatching ? 'rewatching' : malEntry.node.my_list_status?.status),
          customLists: [],
          score: malEntry.node.my_list_status.score,
          startedAt,
          completedAt
        }
      }
    }
  }

  static async updateEntry(filemedia) {
    // check if values exist
    if (filemedia.media && this.isAuthorized()) {
      const { media, failed } = filemedia

      if (failed) return
      if (media.status !== 'FINISHED' && media.status !== 'RELEASING') return

      // check if media can even be watched, ex: it was resolved incorrectly
      // some anime/OVA's can have a single episode, or some movies can have multiple episodes
      const singleEpisode = ((!media.episodes && (Number(filemedia.episode) === 1 || isNaN(Number(filemedia.episode)))) || (media.format === 'MOVIE' && media.episodes === 1)) && 1 // movie check
      const videoEpisode = Number(filemedia.episode) || singleEpisode
      const mediaEpisode = media.episodes || media.nextAiringEpisode?.episode || singleEpisode

      if (!videoEpisode || !mediaEpisode) return
      // check episode range, safety check if `failed` didn't catch this
      if (videoEpisode > mediaEpisode) return

      const lists = media.mediaListEntry?.customLists.filter(list => list.enabled).map(list => list.name) || []

      const status = media.mediaListEntry?.status === 'REPEATING' ? 'REPEATING' : 'CURRENT'
      const progress = media.mediaListEntry?.progress

      // check user's own watch progress
      if (progress > videoEpisode) return
      if (progress === videoEpisode && videoEpisode !== mediaEpisode && !singleEpisode) return

      const variables = {
        repeat: media.mediaListEntry?.repeat || 0,
        id: media.id,
        status,
        score: (media.mediaListEntry?.score ? media.mediaListEntry?.score : 0),
        episode: videoEpisode,
        lists
      }
      if (videoEpisode === mediaEpisode) {
        variables.status = 'COMPLETED'
        if (media.mediaListEntry?.status === 'REPEATING') variables.repeat = media.mediaListEntry.repeat + 1
      }

      Object.assign(variables, this.getFuzzyDate(media, status))

      let res
      if (this.isAniAuth()) {
        res = await anilistClient.alEntry(lists, variables)
      } else if (this.isMalAuth()) {
        res = await malClient.malEntry(media, variables)
      }

      const description = `Title: ${anilistClient.title(media)}\nStatus: ${this.statusName[media.mediaListEntry.status]}\nEpisode: ${videoEpisode} / ${media.episodes ? media.episodes : '?'}`
      if (res?.data?.mediaListEntry || res?.data?.SaveMediaListEntry) {
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
    }
  }

  static getPaginatedMediaList(page, perPage, variables, mediaList) {
    const ids = this.isAniAuth() ? mediaList.filter(({ media }) => {
        if ((!variables.hideSubs || malDubs.dubLists.value.dubbed.includes(media.idMal)) &&
          this.matchTitle(media, variables.search, ['title.userPreferred', 'title.english', 'title.romaji', 'title.native']) &&
          (!variables.genre || variables.genre.map(genre => genre.trim().toLowerCase()).every(genre => media.genres.map(genre => genre.trim().toLowerCase()).includes(genre))) &&
          (!variables.tag || variables.tag.map(tag => tag.trim().toLowerCase()).every(tag => media.tags.map(tag => tag.name.trim().toLowerCase()).includes(tag))) &&
          (!variables.season || variables.season === media.season) &&
          (!variables.year || variables.year === media.seasonYear) &&
          (!variables.format || variables.format === media.format) &&
          (!variables.status || variables.status === media.status) &&
          (!variables.continueWatching || (media.status === 'FINISHED' || media.mediaListEntry?.progress < media.nextAiringEpisode?.episode - 1))) {
          return true
        }
      }).map(({ media }) => (this.isUserSort(variables) ? media : media.id)) : mediaList.filter(({ node }) => {
        if ((!variables.hideSubs || malDubs.dubLists.value.dubbed.includes(node.id)) &&
          this.matchTitle(node, variables.search, ['title', 'alternative_titles.en', 'alternative_titles.ja']) &&
          (!variables.season || variables.season.toLowerCase() === node.start_season?.season.toLowerCase()) &&
          (!variables.year || variables.year === node.start_season?.year) &&
          (!variables.format || (variables.format !== 'TV_SHORT' && variables.format === node.media_type.toUpperCase()) || (variables.format === 'TV_SHORT' && node.average_episode_duration < 1200)) &&
          (!variables.status || variables.status === 'CANCELLED' || variables.status === this.airingMap(node.status))) {
          // api does provide airing episode or tags, additionally genres are inaccurate and tags do not exist.
          return true
        }
      }).map(({ node }) => node.id)
    if (!ids.length) return {}
    if (this.isUserSort(variables)) {
      const updatedVariables = { ...variables }
      delete updatedVariables.sort // delete user sort as you can't sort by user specific sorting on AniList when logged into MyAnimeList.
      const startIndex = (perPage * (page - 1))
      const endIndex = startIndex + perPage
      const paginatedIds = ids.slice(startIndex, endIndex)
      const hasNextPage = ids.length > endIndex
      const idIndexMap = paginatedIds.reduce((map, id, index) => { map[id] = index; return map }, {})
      return this.isAniAuth() ? {
        data: {
          Page: {
            pageInfo: {
              hasNextPage: hasNextPage
            },
            media: paginatedIds
          }
        }
      } : anilistClient.searchIDS({ page: 1, perPage, idMal: paginatedIds, ...this.sanitiseObject(updatedVariables) }).then(res => {
        res.data.Page.pageInfo.hasNextPage = hasNextPage
        res.data.Page.media = res.data.Page.media.sort((a, b) => { return idIndexMap[a.idMal] - idIndexMap[b.idMal] })
        return res
      })
    } else {
      return anilistClient.searchIDS({ page, perPage, ...({[this.isAniAuth() ? 'id' : 'idMal']: ids}), ...this.sanitiseObject(variables) }).then(res => {
        return res
      })
    }
  }
}
