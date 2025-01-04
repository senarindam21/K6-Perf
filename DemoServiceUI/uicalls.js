import { check } from 'k6'
import http from "k6/http";

const vars = {}

  let launchpage = function () {
    let tagname = "T01_Demo_K6LaunchPage"
    let response = http.get('https://test.k6.io/', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Host': 'test.k6.io',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'   
      },
      tags: {name: tagname, RT: tagname, TPS: tagname}
    })

    ChecksandDebug(response, tagname);
  }

  let loginpage = function () {
    let tagname = "T02_Demo_K6LoginPage"
    let response = http.get('https://test.k6.io/my_messages.php', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Host': 'test.k6.io',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      },
      tags: {name: tagname, RT: tagname, TPS: tagname}
    })

    vars['redir1'] = response.html().find('input[name=redir]').first().attr('value')

    vars['csrftoken1'] = response.html().find('input[name=csrftoken]').first().attr('value')

    ChecksandDebug(response, tagname);

  }

let login = function () {
   let tagname = "T03_Demo_K6Login"
   let response = http.post(
      'https://test.k6.io/login.php',
      {
        redir: `${vars['redir1']}`,
        csrftoken: `${vars['csrftoken1']}`,
        login: 'admin',
        password: '123',
      },
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': 'test.k6.io',
          'Origin': 'https://test.k6.io',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'  
        },
        //tags: {name: tagname, RT: tagname, TPS: tagname}
      }
    )

    response = http.get('https://test.k6.io/my_messages.php', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Host': 'test.k6.io',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      },
      tags: {name: tagname, RT: tagname, TPS: tagname}
    })

    vars['redir2'] = response.html().find('input[name=redir]').first().attr('value')

    vars['csrftoken2'] = response.html().find('input[name=csrftoken]').first().attr('value')

    ChecksandDebug(response, tagname);
  }

let logout = function () {
    let tagname = "T04_Demo_K6Logout"
    let response = http.post(
      'https://test.k6.io/login.php',
      {
        redir: `${vars['redir2']}`,
        csrftoken: `${vars['csrftoken2']}`,
      },
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': 'test.k6.io',
          'Origin': 'https://test.k6.io',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'
        },
        //tags: {name: tagname, RT: tagname, TPS: tagname}
      }
    )

    response = http.get('https://test.k6.io/my_messages.php', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Host': 'test.k6.io',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      },
      tags: {name: tagname, RT: tagname, TPS: tagname}
    })
    ChecksandDebug(response, tagname);
  }

  function ChecksandDebug(response, tagname){
    if(response.status ==200 || response.status ==302){
        check(response, {Validation : (r) => r.status === response.status}, {Checks:tagname});
    }
    else{
        check(response, {Validation: (r) => r.status ==200 || r.status ==302}, {Checks:tagname});
        console.log(`${tagname} failed with status code: `, response.status);

    if(DebugMessage == "yes"){
        console.log("Transaction Name: "+tagname)
        console.log("Response Body for debug: ", tagname, response.body);
     }
    }
}

  export default Object.freeze({

    launchpage,
    loginpage,
    login,
    logout

  })
