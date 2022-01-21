<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  const msg = ref('Gerador de playlist aleatória do Spotify')

  // Map for localStorage keys
  const LOCALSTORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp',
  }

  const getLocalStorage = () =>{
    // Map to retrieve localStorage values
    const LOCALSTORAGE_VALUES = {    
      accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
      expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
      timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
    };
    return LOCALSTORAGE_VALUES
  }

  const state = reactive({
    // title: 'Gerador de playlist aleatória do Spotify',
    randomic_playlist: null,
    playlists: [],
    devices: [],
    tracks: [],
    user: null,
    message: '',
    track: {
      name: 'Musica X',
      artist: 'Artista Y',
      time: "1:01",
      timeTotal: "2:44"
    }
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  
  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = getLocalStorage()
    if(!accessToken || !timestamp || !expireTime){ 
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    return (millisecondsElapsed / 1000) > Number(expireTime)
  }

  const logout = () => {
    // Clear all localStorage items
    for (const property in LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    state.user = null
    router.push('/login')
  }

  const getPlaylists = async() => {
    const { accessToken } = getLocalStorage()
    // console.log('buscando playlists...')
    await axios
      .get('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        // console.log(response.data.items)
        state.playlists = response.data.items.filter(item => item.public)        
        // console.log(state.playlists)
      })
      .catch(error => {
        console.log(error)
      })
  }

  const getTracks = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    
    await axios
      .get(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        let tracks = state.tracks.length
        // console.log(tracks + 'musicas')
        // console.log(response.data.items)
        //adicionar 2 musicas aleatórias dessa playlist com as demais
        while(state.tracks.length < tracks + 2) {
          let random = Math.floor(Math.random() * response.data.items.length)
          let track = response.data.items[random].track
          state.tracks.push(track)
        }
        
        // state.tracks = state.tracks.concat(response.data.items.map(item => item.track))
        // state.tracks = response.data.items
        // state.playlists = response.data.items.filter(item => item.public)        
      })
  }

  const generatePlaylist = async() => {
    state.tracks = []
    console.log('Gerando playlist...')
    const unresolved = state.playlists.map(async(playlist) => {
      await getTracks(playlist.id)
    })
    const resolved = await Promise.all(unresolved)
    console.log(`Playlist gerada com sucesso com ${state.tracks.length} músicas!`)
  }

  const getProfile = async() => {
    const { accessToken } = getLocalStorage()
    // alert('getprofile inicio, token: '+ accessToken)
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        // console.log(response.data)
        state.user = response.data
      })
      .catch(error => {
        console.log(error)
      })
  }

  const savePlaylist = async() => {
    const { accessToken } = getLocalStorage()
    const user_id = state.user.id
    const name = prompt('Informe o Nome da playlist: ', 'Playlist Aleatória')
    const description = 'Playlist gerada automaticamente pelo gerador de playlist aleatória do Spotify @evaldorcardoso'
    const _public = true
    // const tracks = state.tracks.map(track => track.uri)
    
    //let query = `name=${name}&description=${description}&public=${_public}`
    const formData = {
      'name' : name,
      'description': description,
      'public': _public
    }
    await axios
      .post(`https://api.spotify.com/v1/users/${user_id}/playlists`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        state.randomic_playlist = response.data
        state.message = 'Playlist criada com sucesso!'
        router.push('/')
        addTracksToPlaylist(response.data.id)
      })
      .catch(error => {
        console.log('Nao foi possivel salvar a playlist:')
        console.log(error)
      })
  }

  const addTracksToPlaylist = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    const tracks = state.tracks.map(track => track.uri)
    const formData = {
      'uris': tracks
    }
    axios
      .post(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        state.playlist = response.data
        state.message = 'As músicas foram adicionadas com sucesso!'
        router.push('/')
      })
      .catch(error => {
        console.log('Nao foi possivel adicionar as musicas a playlist:')
        console.log(error)
      })
  }

  const executePlaylist = async() => {
    const { accessToken } = getLocalStorage()
    const formData = {
       "context_uri": "spotify:playlist:" + state.randomic_playlist.id,
        "offset": {
          "position": 0
        },
        "position_ms": 0,
    }
    axios
      .put(`https://api.spotify.com/v1/me/player/play`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
  }

  const getDevices = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        console.log(response.data)
        //state.devices = response.data.devices
      })
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  onMounted(async () => {
    // var params = window.location.search.substr(1)
    var params = window.location.hash
    console.log(params)
    if(params){
      params = params.split('#')[1]
      params = params.split('&')
      params = params.map(param => {
        param = param.split('=')
        console.log(param);        
        return {
          key: param[0],
          value: param[1]
        }
      })

      params = params.reduce((acc, param) => {
        acc[param.key] = param.value
        return acc
      }, {}) 
      if(params.access_token){
        localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, params.access_token)        
        localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, params.expires_in)
        localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())        
        router.push('/')
        // setTimeout(() => {
        //   window.location.reload()
        // }, 1000)
      }
    }

    if(hasTokenExpired()){        
      logout()
      return
    }      
    getProfile()
    getPlaylists()    
  })

</script>

<template>
  <h2 class="center" style="margin-top: 50px;color:#fff">{{ msg }}</h2>
    
  <p>
    <div v-if="state.user">                  
      <div v-if="state.player" class="player">
        <div class="artwork">
          <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw4QDw8ODhAPDxAPEBUPEBAQDhAPDxUQFRUWFhUVFRYYHSggGB0mGxUVITEhJSkrLi4uFyAzODMtNygtLisBCgoKDg0OGhAQGzIlICUtLS0vLS0tLysvLS0vLS0vLS0tLS0tLS0vLS0tLS0rLS0tLS8tLS0tLS0tKy0tLS0tLf/AABEIAOEA4QMBIgACEQEDEQH/xAAcAAEAAgMBAQEAAAAAAAAAAAAAAQIEBQYDBwj/xAA/EAABBAAEAwYDBQYFBAMAAAABAAIDEQQSITEFQVEGEyJhcYEykaFSscHR8BQjM0JicgeCwuHxU3OSkyQ0Q//EABsBAQACAwEBAAAAAAAAAAAAAAABBQIDBAYH/8QANhEAAgECAwQJAwMDBQAAAAAAAAECAxEEITESQVGxBSJhcYGRodHwE8HhMkLxFDPSIzRScqL/2gAMAwEAAhEDEQA/AOyRFZfPT0xVERAWVVZVQBERASiIhAREQklQvPETMjY+SQhrI2l73HYNaLcT6AFY2HxzpGF4ikip4Y0YjLFmBLfE3KXaHNoDRsVQUpN5mO0tDNRarB8XEmMxGFoAQgZH3q54ax0or+kTQ/8AkVtUasE7hERQSEREFwiIgCIiAIiIToEREIClQiE3IREQBWVVZAVRWVUARFZAVUqFKBhERCCCL0OoO4WrwfAoIe8EXgEkzJi1rImMHduDmtaxgAA0q9zepOi2qLJSa0IcU9TU4XgEEconYCJu9lmdLTe8eJS8mOR1WWDMKHLI1bZEUNt6kxiloERFBKCIiAIiIQEREARFKEkIiIGQpRSosCqIikBFZVQBERAFZVRAFKhEBKItdxnjmGwYjOJf3YldkZ4Hut2mnhBrfnSyjCU3sxV3wREpKKuzYrXdoOJHC4aScNzubTWgmhmc4NBPkLv2WdDK17WvY4Oa4BzXA2CDsVXE4dkjHRyDMx4pw1Fj2UwaUltLJPP2IldrI5Hg3CsfiImYx3EJoXzxh7Y2VNG0OAIJDqbemwaALI13XW4NsgijbM4PlEbRI9oprpABmcByBNlfP54OI8F8WHrFcPBJ7p152Enru0k3qLBJ2FgDveG46PEQx4iI3HKwPaedHkfMGwfMLpxUZZTTTg3k0krdj3prtv2No0UGtHdS335rdrwMlQ5wAJOwFn0CleeIizsfHZGdjmWNxmBFj5rj7zoZy0fFMUf2bGuce6xEkTGYYMb3Xczvaxrg8HMZBmDjYrcADddaua4P2REMkcssrZTCGBgiw8WHBcxpYx8hbbpHAE7mtdl0q3VXFvq+nouOS3vNmqkpW63O/LIIiLSbQiIgClQiEhERCAiIouCVVEUkhERAERWQFVZQo9NfojARfMuAdvsY3vX42MywxyFsro2ND4SSaFjRwADhqAdBqbX0HhXFMPioxNhpGysuiWnUHenDdp8iunEYSrQfXWXFZr53mmlXhU08jCw3FnNx02DnIGYMlwrsuXM0tOaO+ZBY4jr4vsmtZ/inGHcLmsAkSRZSa0cZGix7Ej3W37Q8BixkYa/wvZrFK34mO66eYB9QFwvG8Lx3ERt4XLEHsErD+104tdENs7qo0TmJ0Jy7dd+EjB1IVFJLZabTyyVs1fXu1vomaa7koyi1e97W7dzO37Gsrh2BGv8A9aM6+bQfxW5XhgcMIoo4WkkRRtiBO5ygCz5mrWm7UDijTHNw4xSBgcJMO8AOeTVOa46aVtpud9K5Ir6lS10rvV5I6L7ENNLaG34lFE+GVk9d0Ynd4XbBlWT7b+y43/CSR/7NiYs2eGHEFsL7u7FvA8tnf51i41vHeKAYSTDs4fBYM0hsl2UggAXZF0aGhI1K7vhfD4sNDHh4RTI20L3J5uceZJsk9SuiaVGg6bkm5NOyd0rb7rK7va3DwNMX9SoppWST7L33dxkPeGgucQA0EknYAaklfPuy3GuIcS4g6dj3x4GAuBZQDHNIqNv9Tzo4nl5Xrvu3/Enw4TuYA52IxjxhYA3fM/c3yNbHqQs7spwNmAwrMO0hzrL5XDZ0rviI8tAB5ALGns06Dm11pZK+dl+58knxuTO86iitFm+/cvc26xcdxHDwAHETRQg7GWRkd+lnVabtrx5+EijZAA7E4l/cwXqGnQF5HOi5oA6uCxuC9iYG3NxD/wCdipADI+f94xpr4WNOlan8KWtUkobc3ZO9ktXbXhZbr8TOVR7WzFaa8EdFguI4ecXBNDMN/wB3I1/3FZS5ziPYvASU6KIYSZusc2F/cPa7rTaB+S3XDWzCGIYhzXTBgErmaNc8DUjQb77LCSja8X4P5n6Z+ZlFyvaS8jJREWszCIiAIiISSihEFyEREARFZAFChEBi8WfM3DzOwzQ+YRuMTTsZK8I89V8y4LxftBi3Sfs+KizRkXHK2BjjpbsoyVodDrpsvq65LtP2de14x/DmNGJY7O+NvhEho+MDYv1II/mBIOtFduEqwipQkld6OSTS777nx3anLiKcnaSbstUnY1vYzgHEI8ZjJcbFE2HFsd3zPAWPkJvwtBOnifd6alePFeyGLwGJZjeC5iHOqXCl4Dcu9eIjMzyOoJBHl3XCMe3EwRzta5okbeVzXNIINEUQDuDrzWWpljKsarbSWSi42ydlazXZ5rdYRw8HBJPtT358CkBcWNMjQ15aC9rXZ2h1agOoWL50FdTG1zzljaXnnXL1Ow91sIeBuP8AFkDf6WCz8z+RWqhhK1fOEcuOi8/a7NtSrCn+p+5rS4Kplb1C6CPg+Hbu0u0Bt7nO0Plt9FktwMI0EUQ1I/hs5eysI9DVH+qSXcr+xzPpCmtE+Ry4mb1HzUh46rpXYKAjWGI6X/DZ+S8JeB4Z2zMpura5zPoDSmXQs9015fyFj4PWL9Pwc9JBG5zHOY1zoyXMcWglpIIJaeRokaL1WbPwF7dYZb/pkH+pv5LXSl8ZyzMLCdidWn0cNCuCvg69FXksuKzR00q1Op+h5+TOQ/xBgLJeH48APGGnDXMddeNzXAjQ6+CttyNV1uExDJY2SxkOZI0PaRza4WFj8Y4ezFYeXDuNCVtBwAJa7drhfMEA+y5vgTOI4KeLCzsE2GmJbG+HMY4nAF2uclzRQOm3Q3dlarRUb9aN+y8dcu1O/qa3enUbtk/R6ex2SIi5DoCIiAIiILBERAEREBCKyISVREQBERAFKhCUAca1K2GB4U6SnS2xh2bs93r0H19F7cK4doJpR5sYen2j+HzWyEma8viANOIPh9QevkrzA9HRsqlbwj937efAr8Timm40/F+3v5ExxtY0NYA0agACvF0KGUb/AOYemzgseUEgnNy1ocxsViQy5rI8VHUDcE76K5VWGiZW7N8zZOlA08i323CkS/ff0XjHVAn66L2bS2XIJa/7gFbP+J9ymUKkjNNTShu2pBcuH4ew3XnKxjwWuAc07ggEVysLAkzOeWwuBDKDy5vh1s0K/Xqshznt3aXczl1/QWCqRZlss1GP4M+O34e3N3MRNuH9h5+h1+5YMMwcLC6qGdrhob/NarjXC7JnhHj3e0fzjy/q+9VeN6NU1t0lnw493z82GHxb/RVfj7+/xa9F5QShwBC9V54smEREICIiCwREQlBFCIQWVURCQiIgCIiALP4Tg+8fmcPAzfoXch+Py6rA9NSdAPNdPhoBHG2MakC3a1bjuQfX8FZdGYZVqt5LKPq9y7tfRHJjKzpwstX8Z7DWzrQFkg0R1C85n2x2Xr4RtovSSUCEuvrqet1+CwsdPkjAGjnbHoOZV1iq8YJybySv7FXTg5NIOxsMej3a0bABcdRzpaUNjEwkw0o6ujfbST5XusKY2SseSC1TLHzeqVvm8t44GnbNu/gdrjDHIzMfiAqhrr5HqtbDinsdkcb6daWs4JxBzQ+N1uppLB9ogHw+ui9pHW+IkuJcMxzCjvt7XStqOI27S4lfVoOlJwZ1EHw3etX7LyeSc3nt6rynnEZFmhlA9CFg8TxLmksYeXiI315D5j5rDE4uNPN7svY1UqTm7Iu6fu5xGGHK8AueB4QedlZwmbsDdH5risaDueaw4sY+N1gmhpudt6HyXNSx7esfX8Fi+jHKN4yz7js+IwuaTMygBVgaWOpWVhJw9gcNitfwicywm3XehAFaEdepV+DTDxxivA4jTXmrWjPa0KyUWrp7jXcZwfcyd60UyQ+IdHnn7/f6rxBXR47DtkjdG7Zwrz9fbdcthyRbHfEwlrvUaKk6VwyhP6kdHr3/AJLPB1tuGy9Vy3GQoRSqg7AoREAREQgKURCSqIiAKyqiAIiIDO4PFmmbezAXn20H1I+S3cjtDfPqLHzWt4A3SV/9oH1J/BZ07q2r2dS9R0VDZwyfFt+tvsU2MltVrcLL7/cnGQ97AG5qBNuI6XqF48UkYQb0GRwbpevg+WjSvXAutpYeZsfioxMIkaWE0T8PWx5fNMXSk4yUFm0ln2XsvXLtMKU7STei+5y3NQTSvjMPJG4gtO+4BIKwp5HnTKRy1HPp6rz0aUm7WL9WavdWIlmaw5jenwhu5cToAtngWujxOE72y58dyC9GuLzlo8/P+1YHDsE4v76XwxxE011gveBoAOt1+rW0hw75ZBNJpVUNtle4ShKEMyrxdWMp9XS1jecQiBBzAOzaHMLGXpS1PFCCbvW3Bw166fNbmLEB/gIpza32cK3HXY6b6el4XE+HF9vZo6tRyK0Y7DzlF7Oed/45GnC1YxklJ2OVxh31WtleOS22L4fiLIMbtOlFU4b2cmkfnl8EbT8J+Irko0ZPKxfqvSpw2pSXnc2vZcOZCXO2IHyAXvwF2aV7hoCSfmbVsfOyOPuo6sjKB96zOBYXIyzu5XmGhY85WntNy4mxcFzPFosmJvlK2/8AM3Q/TKunetF2jZ/Cf0fl9i0/iAo6QpqeHl2Z+X4JwcrVl25GCigKV5IuQiIgClQiEhEUoRYqiKyElUREAREQG94H/Bd/3f8AS1e2Kvz+QWPwQ/unjo8O+f8AwvbFey9fgf8AbQ7ijxH96XeTAzSwpaH5yXVWtVebUDf5K+CdosktC3ygpGlSsa7FjNbTGHAtOpykE9PJacwOM7JXNe4sj7prNWx6AeIg3fTkdPddK5ioWBa3Ru73M41LKxqzgHSPD5HE18LR8I8lniFewClbVFIwbbMcxEajkrDFOAoi/PZeyqWBQ4JkGHNinAGmFzuVuAb7n/ZYk2IxDxlAbHe9Ev8AloFtDEE7oLH6UTJSNPguF04PeS43zW9jFLFmnjjoyPawbAucG2egtZMTgdRqFsVlkhK7zZd361Wn7RD90P72/etw4rTdoXfu2N+1IB8rP4LTin/oT/6vkzZhv70e9GsbspUBSvGl4wiIhIRSoQBSiICqIiAIiICyqiIDa8Bf4ns+0y/dp/In5LPnFhaLCzd3Ix/2Tr9x+lroJhvVEHxCtqXpOiKqlQcN8X6PPncqcdC1Ta4rl+LHhhH0aWcZANzVrUTPyW6roE6aDQbDqV8l4lxvH98Ze+kD/wCIA1zqyEigG7VrsVZynYYXBSxCbTSStr2n3DNao4LR9k+PR4vDxuzNEtVIwEW1w306cx5LfKU7nJOEoScZaoqoRSpMSFKhRaAlVJUkrSdpuNswkJNjvCCI26XfJxHQKJSSV2bKVKVSahDVnz/t1xB78S8Pc6o3lsbWkZQxpcLHnbXX/svofYyR7sDh3yXmcy9dy2zlPypcJ2Q4EMfiHzzguhjN0SfG4kuoncjUk9V9TY0AAAANAoAAZQBy8lqpK/WZbdK1YRhDDR/bZ+n31fh4Wd+uS0HHJM0kbfs24/cP9S3kjqBP+49lzMsmeR7+RND0/Vn3XJ0pV2MO4/8AJ29/nccOBheptcPiCIi8uW4REQgIiIApUKUJKoiIAisqoArKqIAt3wvEZ48h+KP4fNnL5bfJaRekErmOD27g+3oV1YPEvD1VLdo+73WvpvNNel9WGz5d5up2Xr9efsFx3GOyEcsnewvMEgN0P4ZPl9k2fMa7Ls2Stkb3jdj8Q5trcLykj9q+QH5r1i2ZpNO63MqaNapQk3F2e/8AKPjeIwcuHkLw50U8byRp3eaty111m6t819D7N9uIJmBmJcIJwKdn8LHHqCdvQrK4xwWHFNLZQQ6h420HD7N3offblS+a9oOEy4eUxgOf3bgGOLD3bmEWLJ03NVe9rDOLLtSo4+FpZSXzJ71fdqfa48Q1wtrg4HYgghei/P2GxsjCHN71moJdHI9nT1F16brbxdqsa34MRiARs2Qh49zf4LPbfA5X0Q3+mfmmuVz7QqukC+NydsOInR2Ie3TdkTHfcAsHF8UmlYe+nxMriCazkRgDmQSU2jBdFTv1pLwu+duZ9S412twsALWOE0vJkZDmjlb3DSrXz+BmL4piDVm3AveQQwN5X0aOTef3enZLs0/GtJdNlwzX6gR1I53S6rnvrvsvqHDOHw4eMRQMDAOm5PMuO5Kx2XN5m91qOBTjTV57293zWy8Wy3B+HR4WFkEWzdydC5x3J81m3/zz9wqj539R+ax8ViQxpcT6ddeXmtmUVwSKaTlOV3m3zMXjGJpuRvxO6dOZWqa2hSs5xc4vdueXToEXlMdiv6irdaLJe/jystxc0KP0oW37wiIuI3hERCAiIgCIpQWKqyIhIVURAWVUVkBVERAe2GxDo3Zm+hHIhbeKRsgzM1rUsPI8rWjUseWkOaSCNiF34PHyw/VeceHDtX3Wj78zmxGGVXPR/NTduZ7m69XHmsPGYFkrHRvGZjhRB6DW/I3zXpBxIHSUUftt/ELLa0OHgIcNBoeQ3C9HQxNKuuo79m/y9roq5U6lJ3at2/k4uXsHhP5DNGdNWvB1PqFg4jsRJ/8AniAf749aut9V9CLdbI5l3y2Vcgr2aPqtrgjoh0jiI/uv3pP7HzR3YrG6/vMPzN5X8v8AL5r3wP8Ah7K5zRiZwWB38OMEg6Xudr9F9GyC/d4Vh18mn3Gh+ihQSM59J4iS1XkY2EwrI2NYwBrGtADRoAzavZZY6exPnyK85JGtFkgAXvoKPJYOI4lyj15Wb/5KwrYinRV5u3PwWpxwpzqvqq/zjoZWJxTWCzueQ18XktPNK55t3sOn+6o4km3Gz1P60RedxnSEsR1Y5R4b33+3nctKGGjSzeb+ae4REVcdQREQIIiIQEREARFKEhFVWQFUVlVAFZVRAFZVRAWUIiAI0kGwSD1vVQpQGUziEw/mv+4D7916Dij+YYfY/msFF0xx1eOSqPxd+ZqeHpv9qM48Tfyawex/NeT8bKf5q9gFjIpljcRJZzfhlysQqFNftQcSTZJJ62SURFyt72brBERLgIiIRYIiIAiIgCIiEhFKKLEWKoiKSQisqoCyqiIDyxMLngBrzGQbsafivD9jk/6zvS3VvenivqN1nKqyUmlYyUmlZcjwiw7g0h0jnW8OsWCBoS0anTT6qowz9P3ruWtm/Pn+qWSibTG0/ljHlw7yABI4Vms5SSc2x35An6dEiw7wXXIXZmuaNCKuqO9aeVbrIRZKpJacjS6MXLaeve+V7ehiHCSf9Z1a9dj7oMI8EHvZKHI2fDel6rMRdH9fiNNr/wAx/wAe3U1/0tLg/OXuYv7M/I1vevsOzZtdRlIre99d1Z+GJaG532CTmJN6ggXR1qx8lkItM685u8nvvovsl7dht2FsbG75v1MUYV9SDvXHO1zAToWk3RFHlfKtlT9ifrc0pBv+ZwPPoQKsg7cgs1FlTxNWmrRdvBfdZeFjFUopW+7MB+BkN1PI281fEasUAbdrXt86I95sM5zswke3llDjk2PIH9fVZCJLE1Z22nplotH4c81uNkVs6e/MxDhna1I4X5ydGbW7TVp/9hV8Nh3MLiXueDsCTp9VkItbqSas36L+TLabVgiItZAREQgKVVEJLIotEBKqiICyqiIAiIgCIiAIiIArIiAhQiIQiyIiEkIiIGEUogRCIiBhERAQiIgRZQiIGEREIP/Z" style="width: 100%; height: 100%;" />
        </div>
        <div class="track-name">
          <h2>{{ state.track.name }}</h2>
        </div>
        <div class="track-artists">
          <h3>{{ state.track.artist }}</h3>
        </div>
        <div class="bar-progress">
          <div class="bar-progress-fill" :style="{ width: state.progress + '%' }"></div>
        </div>
        <div class="track-time">
          <span>{{ state.track.time }}</span>
          <span>{{ state.track.timeTotal }}</span>
        </div>
        <!--<div class="player-controls">
          <button class="btn-previous" @click="">Previous</button>
          <button class="btn-play" @click="executePlaylist()">Play</button>
          <button class="btn-next" @click="">Next</button>
        </div>-->          
      </div>
      <button class="btn-generate" @click="generatePlaylist()">
        <font-awesome-icon icon="random" /> Gerar playlist
      </button>
      <button class="btn-generate" @click="getDevices()">
        <font-awesome-icon icon="mobile-alt"/> Dispositivos
      </button>
      <br><hr>
      <div v-if="state.tracks.length > 0">
        <h4>Aqui está sua nova playlist gerada com {{state.tracks.length}} músicas:</h4>
        <!--criar um botão para executar salvar a playlist-->
        <button class="btn-save" @click="savePlaylist()">Salvar playlist</button>
        <p v-if="state.message">{{state.message}}</p>
        <button v-if="state.playlist" @click="executePlaylist()" >Executar playlist</button>
        <a @click="openPlaylistApp(state.randomic_playlist.id)">
          <button v-if="state.playlist">Abrir no Spotify</button>
        </a>
        <div v-for="track in state.tracks" style="display: flex">
          <img :src="track.album.images[0].url" style="width: 50px; height: 50px; border-radius: 50%;" />
          <h5>{{ track.name }}</h5>
          <h6>{{ track.artists[0].name }}</h6>
        </div>
      </div>
      <br><hr>
      <div class="playlists">
        <ul style="list-style: none">
        <li v-for="playlist in state.playlists" :key="playlist.id" style="float:left">
            <img :src="playlist.images[0]?.url"/>
            {{ playlist.name }}
        </li>
        </ul>
      </div>
    </div>

    <div class="login" v-if="!state.user">      
      <img alt="Vue logo" src="../assets/Spotify_Logo_RGB_White.png" />
      <p class="span-login">Para começar, você precisa se autenticar com o Spotify</p>
      <a href="#" @click.prevent="authorize()">
        <button class="but-login">Entrar com Spotify</button>        
      </a>      
    </div>

  </p>
  <br/>
</template>

<style scoped>
.login{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.login img{
  width: 330px;
}
.span-login{
  font-size: 15px;
  margin-top: 40px;
  color: #191414;
}
a {
  color: #42b983;
}
.center{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
}
.playlists{
    display: flex;    
    flex-direction: column;
}
.playlists ul{
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
}
.playlists li{
    display: flex;
    align-items: center;
    margin: 5px;
    color: #fff;
}
.playlists img{
    width:30px;
    margin-right: 10px;
}
.but-login{
  margin-top: 25px;
  background-color: #1DB954;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.btn-logout{
  background-color: #fff;
  color: #42b983;
  border: 1px solid #42b983;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.btn-generate{
  margin-left: 10px;
  background-color: #42b983;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.player{
  margin: 40px auto 40px auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: 400px;
  background-color: #fff;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0px 0px 10px #000;
}
.artwork{
  width: 250px;
  height: 250px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  margin: auto;
}
.track-name{
  text-align: center;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 30px;
}
.track-name h2{
  margin: 0;
}
.track-artists{
  text-align: center;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 30px;
}
.track-artists h3{
  margin: 0;
  color: #999;
}
.bar-progress{
  width: 100%;
  height: 4px;
  background-color: #ccc;
  border-radius: 4px;
}
.bar-progress-fill{
  width: 10%;
  height: 4px;
  background-color: #42b983;
  border-radius: 4px;
}
.track-time{
  margin-top: 5px;
  width: 100%;
  height: 20px;
  text-align: left;
}

.track-time span{
  font-size: 12px;
  float:left;
}
.track-time span:nth-child(2){
  font-size: 12px;
  float:right;
}
</style>
