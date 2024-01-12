// const axios = require('axios');
import axios from "axios"

const url = 'https://socialchain.app/api/mining_sessions/status'; // 요청을 보낼 URL
const token = 'Bearer cbQYRuaKUaBo0jOiVxYcsKEHIY5QiKK2yxj1Z_2dAB8'; // Authorization 토큰

// HTTP 요청 헤더
const headers = {
  'Accept': 'application/json, text/plain, */*',
  'Authorization': token,
  'If-None-Match': 'W/"c8d4ee3ad873ba1ccb4d1d67f9faf70f"',
  'Origin': 'https://app-cdn.minepi.com',
  'Referer': 'https://app-cdn.minepi.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'w': '1',
};

// axios를 사용하여 GET 요청 보내기
axios.get(url, { headers })
  .then(response => {
    console.log('응답 데이터:', response.data);

    
    
  })
  .catch(error => {
    console.error('에러 발생:', error);
  });


