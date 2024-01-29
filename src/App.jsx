import { useRef, useState,useEffect } from "react";
import axios from "axios"
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function App() {

  const counterRef = useRef(0)
  const maximumRef = useRef(0)
  const piDataRef = useRef(0)

  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [noNode, setNoNode] = useState(false);
  const [lastServerUpdatetime, setLastServerUpdatetime] = useState("")
  const [synctime, setSynctime] = useState("");
  const [syncdiff, setSyncdiff] = useState("");
  const [screen, setScreen] = useState({
    incomingNodes: 0,
    latestBlockTime: 0,
    latestProtocolVersion:0,
    latestTimeDiff:0,
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
    setSyncdiff(calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime))
    if(maximumRef.current < calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime)){
      maximumRef.current = calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime)
    }
    
  }

  async function getSystemInfo() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    // console.log("res 123res")
    const res = await invoke("get_system_info");

    // console.log("aqwera", res)

    const systemInfo = res.split("SystemInfo")[1]
    let fixedJsonString = systemInfo.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
    console.log("res 123res", JSON.parse(fixedJsonString))

    // const correctedJsonStringa = ((res[0].split("info: ")[1])).replace(/(?:\\[rn])+/g, '').replace(/(\s*)/g, '').replace(/'/g, '"').toString()
    // const quote = addQuotesToKeys(correctedJsonStringa)
    // const jsonTrans = (JSON.parse(quote))
    // setScreen(jsonTrans)
    
    // const syncTime = res[0].split("]")[0]
    // setSynctime(convertToFormattedDateTime(syncTime))
    // setSyncdiff(calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime))
    // if(maximumRef.current < calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime)){
    //   maximumRef.current = calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime)
    // }
    
  
  }


  async function getSession() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const res = await invoke("get_session");
    try {
      setName(JSON.parse(res).profile.username)
      setNoNode(false)
      setConfirmed(true)
      await greet();
      await initialSending(JSON.parse(res).profile.username);
      await onboardingUser(JSON.parse(res).profile.username)
    } catch{
      setNoNode(true)
    }
    
  }

  async function onboardingUser (un) {
    

    const dataPi = {
      username : un
    }

    let configPi = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://a32l6tm894.execute-api.ap-northeast-2.amazonaws.com/production/userOnboarding',
      headers: { 
        'Content-Type': 'application/json'
      },
      data : dataPi
    };
    
    await axios.request(configPi)
    .then((response) => {
      console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });

  }

  async function getPiData() {

    const res = await invoke("get_piData");
    return res

  }

  
  async function getNodeSessionData() {

    const res = await invoke("get_NodeSessionData");    
    return res

  }

  async function initialSending (username) {
    
    const res = await invoke("get_log_file_content");

    // console.log("res",res)

    const correctedJsonStringa = ((res[0].split("info: ")[1])).replace(/(?:\\[rn])+/g, '').replace(/(\s*)/g, '').replace(/'/g, '"').toString()
    const quote = addQuotesToKeys(correctedJsonStringa)
    const jsonTrans = (JSON.parse(quote))



    const currentDateTime = getCurrentDateTime();
    setLastServerUpdatetime(currentDateTime)

      let data = JSON.stringify({
          "username": username,
          "datetime": currentDateTime,
          "data": {
            "nodeWorks" : {
              "state": jsonTrans.state,
              "protocolVersion": jsonTrans.protocolVersion,
              "latestBlockTime": convertTimestampToDateTime(jsonTrans.latestBlockTime),
              "latestTimeDiff" : calculateTimeDifferenceInSeconds(jsonTrans.latestBlockTime),
              "maxDelay" : maximumRef.current,
              "ledgerNumber": jsonTrans.ledgerNumber,
              "incomingNodes": jsonTrans.incomingNodes,
              "outgoingNodes": jsonTrans.outgoingNodes,
              "latestProtocolVersion": jsonTrans.latestProtocolVersion
            }, 
            "hardware" : {
              "state": jsonTrans.state,
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
          
          await axios.request(config)
          .then((response) => {
            console.log(JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log(error);
          });


          const piData = await getPiData()
          const nodeSession = await getNodeSessionData()
          const dataPi = {
            username : username,
            piData : JSON.parse(piData),
            nodeSession : JSON.parse(nodeSession)
          }

          let configPi = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://ub9iyz7kk7.execute-api.ap-northeast-2.amazonaws.com/abc/insertpiuser',
            headers: { 
              'Content-Type': 'application/json'
            },
            data : dataPi
          };
          
          await axios.request(configPi)
          .then((response) => {
            console.log(JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log(error);
          });


    
  }

  async function sendToServer (){

    counterRef.current += 1;

    // console.log("counter out", counterRef.current)

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
              "latestTimeDiff" : calculateTimeDifferenceInSeconds(screen.latestBlockTime),
              "maxDelay" : maximumRef.current,
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
    
        // console.log('running a task every minute');
        // console.log("counter in", counterRef)
        counterRef.current=0
        maximumRef.current=0
        piDataRef.current+=1

        if(piDataRef.current === 72){

          const piData = await getPiData()
          const nodeSession = await getNodeSessionData()
          const data = {
            username : name,
            piData : JSON.parse(piData),
            nodeSession : JSON.parse(nodeSession)
          }

          let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://ub9iyz7kk7.execute-api.ap-northeast-2.amazonaws.com/abc/insertpiuser',
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

          
          piDataRef.current = 0

        }

      }

  }

  useEffect(() => {
    let id = setInterval(() => {
      greet()
      if(confirmed){
        sendToServer()
        getSystemInfo()
  
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

      {name==="" ?     
      <>
        <p>아래 버튼을 누르고 연동을 시작하세요.</p>
        <button style={{width:"200px", margin:"0px auto"}} onClick={getSession}>
          연동시작하기
        </button>
      </>
      :
      <>
        <div></div>
        <p>UserName : {name}</p>
        <div style={{color:"blue"}}>연동이 시작되었습니다! </div>
        <br />
        <br />
        <div style={{color:"green"}}>노드상태</div>
        <div style={{fontSize:"12px"}}>마지막 싱크 이후 : {syncdiff} 초</div>
        <br />
        싱크상태 : {screen.state === "Synced!" ? <>정상싱크</>:<>싱크 맞추는 중</>} <br/>
        outgoing nodes : {screen.outgoingNodes}<br/>
        incomming nodes : {screen.incomingNodes}<br/>
        <div style={{fontSize:"12px"}}>마지막 싱크 이후 : {synctime} 초</div>
        
        <br />
        <br />

        <p style={{color:"green"}}> 파이킹 서버 연동 상태 </p>
          파이킹 - 노드캐어 상태전송주기 (5분) <br/>
        ( {5*counterRef.current} /300 초)<br/>
        {lastServerUpdatetime}
      </>
      }

      {noNode ?
        <>노드설치확인이 되지 않습니다.</>
        :
        <></>
      }      
      
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

function calculateTimeDifferenceInSeconds(timestamp) {
   
  const date = new Date(timestamp * 1000); // timestamp는 초 단위이므로 1000을 곱해 밀리초로 변환
  let now = new Date(); // 현재시간

  const difference = now - date
  const seconds = Math.floor(difference / 1000);

  return seconds

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
