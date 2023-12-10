import { useRef, useState,useEffect } from "react";
import axios from "axios"
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function App() {

  const counterRef = useRef(0)
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false)
  const [lastServerUpdatetime, setLastServerUpdatetime] = useState("")
  const [synctime, setSynctime] = useState("");
  const [screen, setScreen] = useState({
    incomingNodes: 0,
    latestBlockTime: 0,
    latestProtocolVersion:0,
    ledgerNumber:0,
    outgoingNodes:0,
    protocolVersion:0,
    state:""
  })

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const res = await invoke("get_log_file_content");

    const correctedJsonStringa = ((res[0].split("info: ")[1])).replace(/(?:\\[rn])+/g, '').replace(/(\s*)/g, '').replace(/'/g, '"').toString()
    const quote = addQuotesToKeys(correctedJsonStringa)
    const jsonTrans = (JSON.parse(quote))
    setScreen(jsonTrans)
    
    const syncTime = res[0].split("]")[0]
    setSynctime(convertToFormattedDateTime(syncTime))

  }


  async function sendToServer (){

    counterRef.current += 1;

    // console.log("counter out", counterRef)

    if(name !== "" && counterRef.current === 60){

      const currentDateTime = getCurrentDateTime();
      setLastServerUpdatetime(currentDateTime)

      let data = JSON.stringify({
          "username": name,
          "datetime": currentDateTime,
          "data": {
            "nodeWorks" : {
              "state": screen.state,
              "protocolVersion": screen.protocolVersion,
              "latestBlockTime": convertTimestampToDateTime(screen.latestBlockTime),
              "ledgerNumber": screen.ledgerNumber,
              "incomingNodes": screen.incomingNodes,
              "outgoingNodes": screen.outgoingNodes,
              "latestProtocolVersion": screen.latestProtocolVersion
            }, 
            "hardware" : {
              "state": screen.state,
            }
        }
        });
   
         
          let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://ub9iyz7kk7.execute-api.ap-northeast-2.amazonaws.com/abc/insertmm',
            headers: { 
              'Content-Type': 'application/json'
            },
            data : data
          };
          
          axios.request(config)
          .then((response) => {
            console.log(JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log(error);
          });
    
      //   console.log('running a task every minute');
        // console.log("counter in", counterRef)
        counterRef.current=0

      }

  }

  useEffect(() => {
    let id = setInterval(() => {
      greet()
      if(confirmed){
        sendToServer()
      }
    }, 5000);
    return () => clearInterval(id);
  });

  function submitHandler (e) {
      e.preventDefault();
      setConfirmed(true)
      greet();
  }

  

  return (
    <div className="container">
      <h1>Welcome to NodeCare!</h1>

      <p>pi username 입력 후 확인을 눌러주세요!</p>

      <form
        className="row"
        onSubmit={submitHandler}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          disabled={confirmed}
        />
        {confirmed ? 
          <button disabled>연동중...</button>
        :
          <button type="submit">확인</button>
        }                
      </form>

      <p></p>
      <p>노드로그</p>
      <p>마지막 싱크를 맞춘 시간 : {synctime}</p>
      <p>싱크상태 : {screen.state}</p>
      <p>outgoing nodes : {screen.outgoingNodes}</p>
      <p>incomming nodes : {screen.incomingNodes}</p>

      <p>마지막 서버 전송 시간 : ({counterRef.current}/60)<br/>
      {lastServerUpdatetime}</p>
    </div>
  );
}

function addQuotesToKeys(text) {
  // 정규 표현식을 사용하여 키와 값을 분리
  const regex = /{([^}]+)}/g;
  const result = text.replace(regex, (match, group) => {
    const updatedGroup = group.replace(/(\w+):/g, '"$1":');
    return `{${updatedGroup}}`;
  });

  return result;
}

function convertToFormattedDateTime(inputString) {
  // 정규식을 사용하여 맨 앞의 [ 제거
  var cleanedString = inputString.replace(/^\[|\]$/g, '');

  // 주어진 문자열을 Date 객체로 변환
  var date = new Date(cleanedString);

  // 원하는 형식으로 포맷팅
  var formattedDateTime =
      date.getFullYear() + '년 ' +
      (date.getMonth() + 1) + '월 ' +
      date.getDate() + '일 ' +
      date.getHours() + '시 ' +
      date.getMinutes() + '분 ' +
      date.getSeconds() + '초';

  return formattedDateTime;
}

function convertTimestampToDateTime(timestamp) {
  const date = new Date(timestamp * 1000); // timestamp는 초 단위이므로 1000을 곱해 밀리초로 변환
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  return formattedDateTime;
}

function getCurrentDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  return formattedDateTime;
}


export default App;
