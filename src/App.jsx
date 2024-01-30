import { useRef, useState,useEffect } from "react";
import axios from "axios"
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function App() {

  const counterRef = useRef(0)
  const maximumRef = useRef(0)
  const piDataRef = useRef(0)

  const [name, setName] = useState("a"); // username
  const [confirmed, setConfirmed] = useState(true);

  const [memoryUsage, setMemoryUsage] = useState({
    total : 0,
    use: 0,
    percent:0
  })

  const [storageUsage, setStorageUsage] = useState({
    total : 0,
    use: 0,
    percent : 0
  })

  const [cpuUsage, setCpuUsage] = useState(0)
  const [winVersion, setWinVersion] = useState("")
  const [cpuModel, setCpuModel] = useState("")
  const [cpuFreq, setCpuFreq] = useState(0)
  const [coreNumber, setCoreNumber] = useState(0)


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

    const res = await invoke("get_system_info");
    const systemInfo = res.split("SystemInfo")[1]
    let fixedJsonString = systemInfo.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');

    // console.log("original", res)
    console.log("res 123res", JSON.parse(fixedJsonString))
    let systemStatus = JSON.parse(fixedJsonString)

    setMemoryUsage({
      total : systemStatus.total_memory,
      use : systemStatus.used_memory,
      percent : systemStatus.used_memory/systemStatus.total_memory*100
    })

    setStorageUsage({
      total : systemStatus.total_storage,
      use : systemStatus.used_storage,
      percent : systemStatus.used_storage/systemStatus.total_storage*100
    })

    setCpuUsage(systemStatus.cpu_percent)
    setWinVersion(systemStatus.os_version)
    setCpuFreq(systemStatus.cpu_freq)
    setCpuModel(systemStatus.cpu_brd)
    setCoreNumber(systemStatus.core_number)


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
    <div className="">

        <WelcomeBanner />

        {/* <div className="bt-5">
           <div className="text-center pt-3 pb-3 btn w-full bg-red-500 text-white">모니터링 서버연동 상태 : 미 연동</div>
        </div> */}

        <ServerStatus coreNumber={coreNumber} cpuModel={cpuModel} cpuFreq={cpuFreq} memstat={memoryUsage} storagestat={storageUsage} cpustat={cpuUsage} winVersion={winVersion}/>

        <NodeStatus />

        <header className="px-5 py-4 border-b border-slate-600 dark:border-slate-700 flex items-center">
          <button className="pt-3 pb-3 btn w-full bg-blue-800 hover:bg-blue-600 text-white">모니터링 시작하기</button>
        </header>
        
      {/* {name==="" ?     
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
      }       */}

      
    </div>
  );
}


function WelcomeBanner() {

  return (
    <div className="relative bg-slate-700 border-b border-slate-600 p-6 rounded-sm overflow-hidden mb-0">
      <div className="absolute right-0 top-0 -mt-4 mr-16 pointer-events-none hidden xl:block" aria-hidden="true">
        <svg width="319" height="198" xmlnsXlink="http://www.w3.org/1999/xlink">
          <defs>
            <path id="welcome-a" d="M64 0l64 128-64-20-64 20z" />
            <path id="welcome-e" d="M40 0l40 80-40-12.5L0 80z" />
            <path id="welcome-g" d="M40 0l40 80-40-12.5L0 80z" />
            <linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="welcome-b">
              <stop stopColor="#A5B4FC" offset="0%" />
              <stop stopColor="#818CF8" offset="100%" />
            </linearGradient>
            <linearGradient x1="50%" y1="24.537%" x2="50%" y2="100%" id="welcome-c">
              <stop stopColor="#4338CA" offset="0%" />
              <stop stopColor="#6366F1" stopOpacity="0" offset="100%" />
            </linearGradient>
          </defs>
          <g fill="none" fillRule="evenodd">
            <g transform="rotate(64 36.592 105.604)">
              <mask id="welcome-d" fill="#fff">
                <use xlinkHref="#welcome-a" />
              </mask>
              <use fill="url(#welcome-b)" xlinkHref="#welcome-a" />
              <path fill="url(#welcome-c)" mask="url(#welcome-d)" d="M64-24h80v152H64z" />
            </g>
            <g transform="rotate(-51 91.324 -105.372)">
              <mask id="welcome-f" fill="#fff">
                <use xlinkHref="#welcome-e" />
              </mask>
              <use fill="url(#welcome-b)" xlinkHref="#welcome-e" />
              <path fill="url(#welcome-c)" mask="url(#welcome-f)" d="M40.333-15.147h50v95h-50z" />
            </g>
            <g transform="rotate(44 61.546 392.623)">
              <mask id="welcome-h" fill="#fff">
                <use xlinkHref="#welcome-g" />
              </mask>
              <use fill="url(#welcome-b)" xlinkHref="#welcome-g" />
              <path fill="url(#welcome-c)" mask="url(#welcome-h)" d="M40.333-15.147h50v95h-50z" />
            </g>
          </g>
        </svg>
      </div>

      <div className="relative">
        <h1 className="text-2xl md:text-3xl text-white dark:text-slate-100 font-bold mb-1">Welcome to NodeCare ! 👋</h1>
        {/* <p className="dark:text-indigo-200">연동하기를 누르고, 손쉬운 노드관리를 시작하세요!</p> */}
        <p className="text-white">Version : 0.9</p>
      </div>
    </div>
  );
}

function ServerStatus({coreNumber, cpuModel, cpuFreq, memstat, storagestat,cpustat, winVersion}) {

  // console.log("memory Usage Inner",memstat)
  // console.log("storagestat",storagestat)

  return (
    <div className="flex flex-col col-span-full xl:col-span-4 bg-gradient-to-b from-slate-700  to-slate-800 dark:bg-none dark:bg-slate-800 shadow-lg rounded-sm border border-slate-700">

      <header className="px-5 py-4 border-b border-slate-600 dark:border-slate-700 flex items-center">
        <h2 className="font-semibold text-slate-200">서버 컴퓨터 정보</h2>
      </header>

      <div className="flex flex-row">
      <div className="flex-1 h-full flex flex-col px-5 py-6">
        <div className="grow flex flex-col justify-center mt-0">

          <div className="text-xs text-slate-500 font-semibold uppercase mb-3">사양</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">CPU 회사/모델명</div>
                <div className="text-slate-400 italic">
                  {cpuModel}
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">CPU 속도</div>
                <div className="text-slate-400 italic">
                  {cpuFreq/1000} Ghz
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">CPU 코어수</div>
                <div className="text-slate-400 italic">
                  {coreNumber}
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">메모리용량</div>
                <div className="text-slate-400 italic">
                  {bytesToGigabytes(memstat.total).toFixed(2)} GB
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">저장장치 타입 및 용량</div>
                <div className="text-slate-400 italic">
                {bytesToGigabytes(storagestat.total).toFixed(2)} GB
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Windows version</div>
                <div className="text-slate-400 italic">                
                  {winVersion}
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      <div className="flex-1 h-full flex flex-col px-5 py-6">
      <div className="text-xs text-slate-500 font-semibold uppercase mb-3">사용량</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">CPU</div>
                <div className="text-slate-400 italic">
                  {cpustat.toFixed(2)} %
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${cpustat}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">RAM</div>
                <div className="text-slate-400 italic">
                {/* {(bytesToGigabytes(memstat.total))} */}
                  {(bytesToGigabytes(memstat.use)).toFixed(2)} <span className="text-slate-500 dark:text-slate-400">/</span> {bytesToGigabytes(memstat.total).toFixed(2)} GB
                  ({memstat.percent.toFixed(2)} %)
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${memstat.percent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Storage</div>
                <div className="text-slate-400 italic">
                {(bytesToGigabytes(storagestat.use)).toFixed(2)} <span className="text-slate-500 dark:text-slate-400">/</span> {bytesToGigabytes(storagestat.total).toFixed(2)} GB
                  ({storagestat.percent.toFixed(2)} %)
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${storagestat.percent}%` }} />
              </div>
            </div>
          </div>
      </div>

    </div>


    </div>
  );

  function bytesToGigabytes(bytes) {
    return bytes / (1024 ** 3); // 1024의 3승으로 나눠서 기가바이트로 변환
  }
  
}

function NodeStatus() {
  return (
    <div className="flex flex-col col-span-full xl:col-span-4 bg-gradient-to-b from-slate-800  to-slate-900 dark:bg-none dark:bg-slate-800 shadow-lg rounded-sm border border-slate-700">
      <header className="px-5 py-4 border-b border-slate-600 dark:border-slate-700 flex items-center">
        <h2 className="font-semibold text-slate-200">소프트웨어 및 노드정보</h2>
      </header>
      <div className="flex flex-col col-span-full xl:col-span-4 bg-gradient-to-b from-slate-800  to-slate-900 dark:bg-none dark:bg-slate-800 shadow-lg rounded-sm border border-slate-700">

      <div className="flex flex-row">
      <div className="flex-1 h-full flex flex-col px-5 py-6">
        <div className="grow flex flex-col justify-center mt-0">

          <div className="text-xs text-slate-500 font-semibold uppercase mb-3">소프트웨어</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">도커 버전</div>
                <div className="text-slate-400 italic">
                  {/* {cpuModel} */}
                  4.2.3
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">도커 CPUS</div>
                <div className="text-slate-400 italic">
                  32
                  {/* {cpuFreq/1000} Ghz */}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-semibold uppercase mt-3 mb-3">모니터링</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">연동상태</div>
                <div className="text-slate-400 italic">
                  연결됨
                  {/* {cpuModel} */}
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">유저네임</div>
                <div className="text-slate-400 italic">
                  pirick2053
                  {/* {cpuFreq/1000} Ghz */}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="flex-1 h-full flex flex-col px-5 py-6">
      <div className="text-xs text-slate-500 font-semibold uppercase mb-3">노드현황</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Sync State</div>
                <div className="text-slate-400 italic">
                    Synced!
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-4">
                <div className="text-slate-300">Latest Block 싱크 이후 시간</div>
                <div className="text-slate-400 italic">
                    Synced!
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Outgoing Connections</div>
                <div className="text-slate-400 italic">
                  1 <span className="text-slate-500 dark:text-slate-400">/</span> 8
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${20}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Incoming Connections</div>
                <div className="text-slate-400 italic">
                  1 <span className="text-slate-500 dark:text-slate-400">/</span> 64
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${20}%` }} />
              </div>
            </div>
          </div>
      </div>

      </div>


      </div>
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
