//globals
const axios = require('axios')

let IS_LOGGED_IN = false
let AUTH_TOKEN

class App {

    static getAUTH_TOKEN(){
        return AUTH_TOKEN
    }

    static getIS_LOGGED_IN(){
        return IS_LOGGED_IN
    }

    static setAUTH_TOKEN(token){
        AUTH_TOKEN = token
    }

    static setLOGGED_OUT(){
        IS_LOGGED_IN = false
    }

    static setLOGGED_IN(){
        IS_LOGGED_IN = true
    }

    static async getSummaryInfo() {
        let output = {
            IS_LOGGED_IN
        }
        //set globals?
        return output
    }

}


export default App
