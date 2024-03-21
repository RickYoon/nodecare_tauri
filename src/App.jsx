import { useRef, useState,useEffect } from "react";
import axios from "axios"
import reactLogo from "./assets/piLogoPng.png";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";



function App() {

  const counterRef = useRef(0)
  const maximumRef = useRef(0)
  const piDataRef = useRef(0)

  // State to hold the email input value
  const [email, setEmail] = useState('');
  const [onboardCounter, setOnboardCounter] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // username
  const [name, setName] = useState(""); // username

  const [confirmed, setConfirmed] = useState(false);
  const [dockerInfo, setDockerInfo] = useState({
    version : "",
    cpus: ""
  })

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


  const [noNode, setNoNode] = useState(true);
  const [noEmail, setNoEmail] = useState(false);

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

  async function getStaticInfos(){ // monitoring init

    setIsLoading(true)

    const res = await invoke("get_static_info");
    const correctedJsonStringa = ((res.split("StaticInfo ")[1])).replace(/(?:\\[rn])+/g, '').replace(/(\s*)/g, '').replace(/'/g, '"').toString()
    const quote = addQuotesToKeys(correctedJsonStringa)
    const jsonTrans = (JSON.parse(quote))
    
    setCpuFreq(jsonTrans.cpu_freq)
    setCpuModel(jsonTrans.cpu_brd)
    setCoreNumber(jsonTrans.core_number)
    setWinVersion(jsonTrans.os_version)
    setDockerInfo({
      version: jsonTrans.docker_version,
      cpus: jsonTrans.docker_cpus
    })

    setMemoryUsage({
      total : jsonTrans.total_memory,
      use : 0,
      percent : 0
    })
    
    setStorageUsage({
      total : jsonTrans.total_storage,
      use : 0,
      percent : 0
    })

    //jsonTrans

    await onboardingUser(name, jsonTrans); // email과 유저네임을 기반으로 nodeUser 업데이트한다. 
    await getDynamicInfo();
    await initialSending(name); 

    setIsLoading(false)

  }

  async function getDynamicInfo() {

    // const dockerInfo = await invoke("get_docker_exec");
    // console.log("dynamicInfo",dockerInfo)


    const dynamicInfo = await invoke("get_dynamic_info");
    const systemInfo = dynamicInfo.split("SystemInfo")[1]
    let fixedJsonString = systemInfo.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
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


  async function onboardingUser (un, jsonTrans) {
    

    const dataPi = {
      username : un
    }

    const specData = {
      spec : jsonTrans
    }    

    let mergedObj = { ...dataPi, ...specData };

    let configPi = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://a32l6tm894.execute-api.ap-northeast-2.amazonaws.com/production/userOnboarding',
      headers: { 
        'Content-Type': 'application/json'
      },
      data : mergedObj
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
    
    // node 정보 업데이트 
    const res = await invoke("get_log_file_content");
    const correctedJsonStringa = ((res[0].split("info: ")[1])).replace(/(?:\\[rn])+/g, '').replace(/(\s*)/g, '').replace(/'/g, '"').toString()
    const quote = addQuotesToKeys(correctedJsonStringa)
    const jsonTrans = (JSON.parse(quote))
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
          "cpu": cpuUsage,
          "memory": memoryUsage,
          "storage": storageUsage
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

    // node, session 정보 업데이트 
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
              "cpu": cpuUsage,
              "memory": memoryUsage,
              "storage": storageUsage
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
      // greet()
      if(confirmed){
        sendToServer()
        getDynamicInfo()
      }
    }, 5000);
    return () => clearInterval(id);
  });

  async function emailCheck() {

    setIsLoading(true)
    const emailExist = await checkUser()
    
    if(emailExist == "noEmail"){
      setNoEmail(true)
      setIsLoading(false)
    } else {
      setOnboardCounter(3) // modal close
      setConfirmed(true)
      await accountUpdate()
      await getStaticInfos() // upload inital user info
      setIsLoading(false)
    }

  }

  
    const checkUser = async () => {

      const info = await axios.post(`https://sdbwx50noj.execute-api.ap-northeast-2.amazonaws.com/production/myNodeList`,
      {
        "userEmail": email
      })

      if (info === null || (info.data && info.data.body === "no") || email === "") {
        return "noEmail"
    } else {
      return ""
    }
   }

   const accountUpdate = async () => {

    const info = await axios.post(`https://sdbwx50noj.execute-api.ap-northeast-2.amazonaws.com/production/addNode`,
    {
        userEmail : email,
        nodeName : name
    })
  
  }

  async function pinodeCheck() {

    try {
      const res = await invoke("get_session");

      if(res === null){
        setNoNode(false)
      } else {
        setName(JSON.parse(res).profile.username)
        setNoNode(true)
        setOnboardCounter(2)     
      }

    } catch{
      setNoNode(false)
    }

  }

    // Event handler for input changes
    const handleEmailChange = (event) => {
      // Update the email state with the current input value
      setEmail(event.target.value);
    };

  return (
    <div>

        <WelcomeBanner />

        <ServerStatus coreNumber={coreNumber} cpuModel={cpuModel} cpuFreq={cpuFreq} memstat={memoryUsage} storagestat={storageUsage} cpustat={cpuUsage} winVersion={winVersion}/>

        <NodeStatus name={name} confirmed={confirmed} dockerInf={dockerInfo} screenInfo={screen} syncdiff={syncdiff}/>

        <header className="border-b border-slate-600 dark:border-slate-700 flex items-center">

          <button
            onClick={getStaticInfos}
            className={`m-3 p-3 btn w-full ${confirmed ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-800 hover:bg-blue-600'} text-white`}
            disabled={confirmed}
          >
            {isLoading ? 
              <>데이터 불러오는 중...</>
              :
              onboardCounter === 3 ?              
              <> - 원격진단 중 (주기 5분) -</>
              : 
              <>-</>
              }
          </button>        
        </header>

        {onboardCounter == 0 ? (
            <>
            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                <div className="relative w-full max-w-md max-h-full">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                    
                    <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t text-xl">
                      1. pi node 정보연결 시작하기
                    </div>
                    
                    <div class="p-6">
                        <div>
                            노드의 운영현황을 NodeCare.io 를 통해서
                        </div>
                        <div>
                            언제 어디서든 확인해 보세요!
                        </div>

                        <div className="pt-5 pb-2">
                         아래 버튼을 눌러서 노드정보연동을 시작합니다.
                        </div>
                           {noNode ? 
                          <></>
                          :
                          <div class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">

                          <span class="font-medium">
                            * 파이노드 설치가 확인되지 않습니다.
                          </span> 
                          </div>
                          }
                        <div class="mt-3"></div>
                            {noNode ?
                              <button onClick={pinodeCheck} className="btn w-full round-full pt-2 pb-2 bg-blue-800 hover:bg-blue-600 text-white">
                                시작하기
                             </button> :
                              <button
                              className={"btn w-full round-full pt-2 pb-2 bg-gray-400 text-white"}
                              disabled={true}
                            >
                              설치되어 있지만 인식이 안된다면, <br />
                              네이버 카페 문의 바랍니다.
                            </button>
                            }
                        </div>
                </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>

            </>
        ) : null}

        {onboardCounter == 2 ? (
            <>
            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                <div className="relative w-full max-w-md max-h-full">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                 
                    <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t text-xl">
                      2. NodeCare 계정연결하기
                    </div>
                    
                    <div class="p-6">
                        <div>
                            {name} 님 !<br />
                            NodeCare 에 가입된 이메일주소를 입력해주세요.
                        </div>                   

                        <div>
                          
                        <label for="email" class="pt-5 block mb-2 text-sm font-medium text-gray-900 dark:text-white">Your NodeCare Account (email)</label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          className="mb-5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                          placeholder="name@company.com"
                          value={email}
                          onChange={handleEmailChange}
                          required
                        />
                        </div>
                           {!noEmail ? 
                          <></>
                          :
                          <div class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">

                          <span class="font-medium">
                            해당 이메일은 존재하지 않습니다. <br />
                            확인 후 재기입하시거나, 가입을 안하셧다면 <br />
                            NodeCare.io 가입 후 연결하시기 바랍니다.
                          </span> 
                          </div>
                          }
                        <div class="mt-3"></div>
                        {isLoading?
                        <button disabled className="btn w-full round-full pt-2 pb-2 bg-gray-800 hover:bg-blue-600 text-white">
                          로딩중
                        </button> 
                        :
                        <button onClick={emailCheck} className="btn w-full round-full pt-2 pb-2 bg-blue-800 hover:bg-blue-600 text-white">
                            시작하기
                        </button> 
                        }
                          
                        </div>
                </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>

            </>
        ) : null}    


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
        <div className="flex flex-row">
          <h1 className="text-2xl md:text-3xl text-white dark:text-slate-100 font-bold mb-1">NodeCare.io for </h1>
          <img className="h-8 w-8 ml-3" src={reactLogo} alt="abc svg" />
        </div>
        
        <p className="text-white">v 0.9</p>
      </div>
    </div>
  );
}

function ServerStatus({coreNumber, cpuModel, cpuFreq, memstat, storagestat,cpustat, winVersion}) {

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
    return bytes / (1024 ** 3); 
  }
  
}

function NodeStatus({name, confirmed, screenInfo, syncdiff, dockerInf}) {

  const [hideName, setHideName] = useState(false)

  return (
    <div className="flex flex-col col-span-full xl:col-span-4 bg-gradient-to-b from-slate-800  to-slate-900 dark:bg-none dark:bg-slate-800 shadow-lg rounded-sm border border-slate-700">
      <header className="px-5 py-4 border-b border-slate-600 dark:border-slate-700 flex items-center">
        <h2 className="font-semibold text-slate-200">소프트웨어 및 노드정보</h2>
      </header>
      <div className="flex flex-col col-span-full xl:col-span-4 bg-gradient-to-b from-slate-800  to-slate-900 dark:bg-none dark:bg-slate-800 shadow-lg rounded-sm border border-slate-700">

      <div className="flex flex-row">
      <div className="flex-1 h-full flex flex-col px-5 py-6">
        <div className="grow flex flex-col justify-center mt-0">

          <div className="text-xs text-slate-500 font-semibold uppercase mb-3">docker</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">docker version</div>
                <div className="text-slate-400 italic">
                  {dockerInf.version ? dockerInf.version.split("DockerDesktop")[1] : "-"}
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">CPUs (docker info)</div>
                <div className="text-slate-400 italic">
                  {dockerInf.cpus ? dockerInf.cpus : "-"}
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
                  {confirmed ? "연동됨" : "-"}
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">유저네임
                  <button onClick={()=>setHideName(!hideName)} className="border border-white ml-2 text-sm pl-2 pr-2">
                    {hideName ? 
                    <>보이기</>
                    :
                    <>감추기</>
                    }
                  </button>

                </div>
                <div className="text-slate-400 italic">
                  {hideName ? 
                  <>-</>
                  :
                  name
                  }
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
                    {screenInfo.state}
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-4">
                <div className="text-slate-300">Blockchain Sync Delay (Sec)                
                  {syncdiff > 0 && syncdiff < 60 ?     
                  <span class="ml-5 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.0 rounded dark:bg-blue-900 dark:text-blue-300">Good !</span>
                  :
                  <></>
                  }
                </div>
                <div className="text-slate-400 italic">
                    {syncdiff}  
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <div className="text-slate-300">Outgoing Connections
                {screenInfo.outgoingNodes == 8 ?     
                  <span class="ml-5 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.0 rounded dark:bg-blue-900 dark:text-blue-300">Good !</span>
                  :
                  <></>
                  }
                </div>
                <div className="text-slate-400 italic">
                  {screenInfo.outgoingNodes} <span className="text-slate-500 dark:text-slate-400">/</span> 8
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${screenInfo.outgoingNodes/8*100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2 pt-1">
                <div className="text-slate-300">Incoming Connections
                {screenInfo.incomingNodes > 0 ?     
                  <span class="ml-5 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.0 rounded dark:bg-blue-900 dark:text-blue-300">Good !</span>
                  :
                  <></>
                  }
                </div>
                
                <div className="text-slate-400 italic">
                  {screenInfo.incomingNodes} <span className="text-slate-500 dark:text-slate-400">/</span> 64
                </div>
              </div>
              <div className="relative w-full h-2 bg-slate-600">
                <div className="absolute inset-0 bg-emerald-500" aria-hidden="true" style={{ width: `${screenInfo.incomingNodes/64*100}%` }} />
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