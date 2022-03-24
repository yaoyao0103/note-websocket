'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var opForm=document.querySelector('#opForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;
var sessionId = null;
var localTS = 0;
var remoteTS = 0;
var localOp = null;
var remoteOp = null;
var localOpPrime = null;
var remoteOpPrime = null;
var localOpPrimeArray = new Array;
var remoteOpPrimeArray = new Array;
var opBuffer = new Array();
var CtoS_Msg = null;
var StoC_Msg = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

class Op {
    constructor(sessionId, type, parentId, index, content){
        this.UId = sessionId;
        this.type = type;
        this.parentId = parentId;
        this.index = index;
        this.content = content;
    }
}
const ClientStateEnum = {"Synced":1, "AwaitingACK":2, "AwaitingWithBuffer":3}
Object.freeze(ClientState);

var ClientState=null;

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('/websocket');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();

}


function onConnected() {
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);
    //console.log("session id: ", sessionId);
    //stompClient.subscribe('/user/' + sessionId + '/msg', onMessageReceived);

    // Tell your username to the server
    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    )

    connectingElement.classList.add('hidden');
    ClientState=ClientStateEnum.Synced;
}


function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket! Please refresh the page and try again or contact your administrator.';
    connectingElement.style.color = 'red';
}

function applyOp(op){
    let newNode;
    let newTextNode;
    let nodeOfClient;
    let children;

    if (op.type === 'INSERT') {
        //create new node
        newNode = document.createElement('div');
        newTextNode = document.createTextNode(op.content);
        newNode.appendChild(newTextNode);
        //apply locally
        nodeOfClient = document.getElementById('A_' + op.parentId);
        children = nodeOfClient.children;
        nodeOfClient.insertBefore(newNode, children[op.index]);
    }
    else if (op.type === 'DELETE') {
        //save origin content
        nodeOfClient = document.getElementById('A_' + op.parentId);
        children = nodeOfClient.children;
        nodeOfClient.removeChild(children[op.index]);

    }
    else if (op.type === 'EDIT'){
        //save origin content
        nodeOfClient = document.getElementById('A_' + op.parentId);
        children = nodeOfClient.children;
        children[op.index].innerHTML = op.content;
    }
}

function OT(tarOp, refOp){
    let tarType = tarOp.type;
    let refType = refOp.type;
    let tarOpPrime;
    if(tarType === 'INSERT'){
        if(refType === 'INSERT'){
            tarOpPrime = TII(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TID(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TIE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TIF(tarOp, refOp); // get A'
        }
    }
    else if(tarType === 'DELETE'){
        if(refType === 'INSERT'){
            tarOpPrime = TDI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TDD(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TDE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TDF(tarOp, refOp); // get A'
        }
    }
    else if(tarType === 'EDIT'){
        if(refType === 'INSERT'){
            tarOpPrime = TEI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TED(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TEE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TEF(tarOp, refOp); // get A'
        }
    }
    else if(tarType === 'FOCUS'){
        if(refType === 'INSERT'){
            tarOpPrime = TFI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TFD(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TFE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TFF(tarOp, refOp); // get A'
        }
    }
    return tarOpPrime
}

function send(event) {
    // get Op info
    let type = document.getElementById("A_op").value;
    let parentId = document.getElementById("A_parent").value;
    let index = parseInt(document.getElementById("A_index").value);
    let content = document.getElementById("A_content").value;

    // ---------------------- state: Synced --------------------
    if(ClientState == ClientStateEnum.Synced) {
        /***** ApplyRemoteOp *****/
        // step 1: set localOp to the Op in the received LocalChange event
        localOp = new Op(sessionId, type, parentId, index, content);

        // step 2: increment localTS
        localTS += 1;
        // step 3: call applyOp(localOp)
        applyOp(localOp);

        // step 4: send message to Controller
        if (stompClient) {
            CtoS_Msg = {
                sender: username,
                TS: localTS,
                op: localOp,
                type: 'OP'
            };
            stompClient.send("/app/chat.send", {}, JSON.stringify(CtoS_Msg));
        }

        // buffer is empty => AwaitingACK state
        if(opBuffer.length <= 0){
            ClientState = ClientStateEnum.AwaitingACK;
        }
        // buffer is not empty => AwaitingWithBuffer state
        else{
            ClientState = ClientStateEnum.AwaitingWithBuffer;
        }
    }
    // ---------------------- state: AwaitingACK or AwaitingWithBuffer --------------------
    else {
        /***** ApplyBufferLocalOp *****/
        // step 1: add Op from the received LocalChange event to opBuffer
        localOp = new Op(sessionId, type, parentId, index, content);
        opBuffer.unshift(localOp);

        // step 2: call applyOp(opBuffer.last)
        // let lastOp = opBuffer.pop();
        applyOp(localOp);
        ClientState = ClientStateEnum.AwaitingWithBuffer;
    }
    event.preventDefault();
}

function onMessageReceived(payload) {
    let StoC_msg = JSON.parse(payload.body);
    var messageElement = document.createElement('li');

    // join msg
    if(StoC_msg.type === 'JOIN') {
        if(StoC_msg.sender === username){
            sessionId = StoC_msg.sessionId;
            stompClient.subscribe('/user/' + sessionId + '/msg', onMessageReceived);
        }
        messageElement.classList.add('event-message');
        StoC_msg.content = StoC_msg.sender + ' joined!';
    }

    // leave msg
    else if (StoC_msg.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        StoC_msg.content = StoC_msg.sender + ' left!';
    }

    // ACK
    else if (StoC_msg.type === 'ACK') {
        //-------------------------- State: AwaitingACK ------------------------------
        if(ClientState == ClientStateEnum.AwaitingACK){
            ClientState = ClientStateEnum.Synced;
        }
        //-------------------------- State: AwaitingWithBuffer ------------------------------
        /***** CreatingLocalOpFromBuffer *****/
        else if(ClientState == ClientStateEnum.AwaitingWithBuffer){
            // step 1: increment localTS
            localTS += 1;

            // step 2: set localOp to opBuffer.first
            opBuffer.unshift(localOp);

            // step 3: remove opBuffer.first from opBuffer
            opBuffer.pop();

            if(opBuffer.length <= 0){
                ClientState = ClientStateEnum.AwaitingACK;
            }
            // buffer is not empty => AwaitingWithBuffer state
            else{
                ClientState = ClientStateEnum.AwaitingWithBuffer;
            }
        }
    }

    // Op msg
    else {
        //--------------------------- State: Synced -----------------------------
        if (ClientState==ClientStateEnum.Synced){
            /***** ApplyRemoteOp *****/
            // step 1: set remoteTS and remoteOp to the values within the received StoC Msg event
            remoteOp = StoC_msg.op;
            remoteTS = StoC_msg.TS;

            // step 2: set localTS to the value of remoteTS
            localTS = remoteTS;

            // step 3: call applyOp(remoteOp)
            applyOp(remoteOp);

            ClientState = ClientStateEnum.Synced;
        }
        //-------------------------- State: AwaitingACK ------------------------------
        else if(ClientState == ClientStateEnum.AwaitingACK){
            /***** ApplyRemoteOpWithoutACK *****/
            // step 1: set localTS to remoteTS
            remoteTS = localTS;

            // step 2: increment localTS
            localTS += 1;

            // step 3: set remoteTS and remoteOp to the values within the received StoC Msg event
            remoteTS = StoC_msg.TS
            remoteOp = StoC_msg.op;

            // step 4: obtain remoteOpPrime and localOpPrime by evaluating xform(remoteOp, localOp)
            localOpPrime = OT(localOp, remoteOp);
            remoteOpPrime = OT(remoteOp, localOp);

            // step 5: call applyOp(remoteOpPrime)
            applyOp(remoteOpPrime);

            // step 6: set localOp to the value of localOpPrime
            localOp = localOpPrime;

            // step 7: send localOp to Controller
            if (stompClient) {
                CtoS_Msg = {
                    sender: username,
                    op: localOp,
                    TS: localTS,
                    type: 'OP'
                };
                stompClient.send("/app/chat.send", {}, JSON.stringify(CtoS_Msg));
            }
            if(opBuffer.length <= 0){
                ClientState = ClientStateEnum.AwaitingACK;
            }
            // buffer is not empty => AwaitingWithBuffer state
            else{
                ClientState = ClientStateEnum.AwaitingWithBuffer;
            }
        }
        //-------------------------- State: AwaitingWithBuffer ------------------------------
        else if(ClientState == ClientStateEnum.AwaitingWithBuffer){

            remoteOp = StoC_msg.op;
            /***** ApplyRemoteOpWithBuffer *****/
            // step 1: set localTS to remoteTS
            remoteTS = localTS;

            // step 2: increment localTS
            localTS += 1;

            // step 3: obtain remoteOpPrime[0] by evaluating xform(remoteOp, localOp)
            remoteOpPrimeArray[0] = OT(remoteOp, localOp);

            // step 4: obtain remoteOpPrime[i+1] by evaluating xform(remoteOpPrime[i], opBuffer[i])
            for(let i = 0; i < opBuffer.length; i++){
                remoteOpPrimeArray[i+1] = OT(remoteOpPrimeArray[i], opBuffer[i]);
            }

            // step 5: call applyOp(remoteOpPrime.last)
            applyOp(remoteOpPrimeArray[remoteOpPrimeArray.length-1]);

            // step 6: obtain localOpPrime by evaluating xform(localOp, remoteOp)
            localOpPrime = OT(localOp, remoteOp);

            // step 7: set localOp to the value of localOpPrime
            localOp = localOpPrime;

            // step 8: obtain opBuffer[i] by evaluating xform(opBuffer[i], remoteOpPrime[i]) & send xformed Op in buffer
            console.log("opBuffer.length--" + opBuffer.length);
            for(let j = 0; j < opBuffer.length; j++){
                console.log("in--" + j);
                opBuffer[j] = OT( opBuffer[j], remoteOpPrimeArray[j]);
                if (stompClient) {
                    CtoS_Msg = {
                        sender: username,
                        op: opBuffer[j],
                        TS: localTS,
                        type: 'OP'
                    };
                    stompClient.send("/app/chat.send", {}, JSON.stringify(CtoS_Msg));
                }
            }

            if(opBuffer.length <= 0){
                ClientState = ClientStateEnum.AwaitingACK;
            }
            // buffer is not empty => AwaitingWithBuffer state
            else{
                ClientState = ClientStateEnum.AwaitingWithBuffer;
            }
        }



    }

    // show message on website
    messageElement.classList.add('chat-message');

    var avatarElement = document.createElement('i');
    var avatarText = document.createTextNode(StoC_msg.sender[0]);
    avatarElement.appendChild(avatarText);
    avatarElement.style['background-color'] = getAvatarColor(StoC_msg.sender);

    messageElement.appendChild(avatarElement);

    var usernameElement = document.createElement('span');
    var usernameText = document.createTextNode(StoC_msg.sender);
    usernameElement.appendChild(usernameText);
    messageElement.appendChild(usernameElement);

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(StoC_msg.op.content);
    textElement.appendChild(messageText);

    messageElement.appendChild(textElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }

    var index = Math.abs(hash % colors.length);
    return colors[index];
}




function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
function contain(refParentId, refIndex, tarParentId, tarIndex){
    return false;
}
function TII(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    if(tarParentId != refParentId || tarIndex < refIndex || (tarParentId == refParentId && tarIndex == refIndex && tarUId > refUId)){
        return tarBlockOp;
    }
    // 其他
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}
function TID(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    if(contain(refParentId, refIndex, tarParentId, tarIndex)){
        let xFormedOp = new Op(tarUId, 'null', tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }
    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於等於參考index => 則不改變操作
    else if(tarParentId != refParentId || tarIndex <= refIndex)
        return tarBlockOp;
    // 其他
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
}

function TDI(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作 (因為目標包含參考不需要改變，所以不多寫出來)
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //其他
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}

function TIE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TEI(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //其他
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}

function TIF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFI(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //目標parent包住參考parent，目標操作直接執行
    if(contain(tarParentId,refParentId))
        return tarBlockOp;
    //參考parent包住目標parent，不會發生
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於或參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //若在以下條件:目標index大於等於參考index =>操作index+1
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}
function TDE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TED(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //目標parent包住參考parent，不會有這個操作，因為會鎖住
    //參考parent包住目標parent，不會有這個操作，因為會鎖住
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex <= refIndex)
        return tarBlockOp;
    //若在以下條件: 目標index大於參考index => 則目標index-1
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
    //其他(目標與參考index相等)，不會有這種操作，因為要先focus
}

function TDF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFD(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //其他(目標與參考index相等)，不會有這種操作，因為要先focus
    if(tarParentId != refParentId || tarIndex <= refIndex){
        return tarBlockOp;
    }
    //條件: tarIndex > refIndex 或者其他
    else{
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
}
function TDD(tarBlockOp, refBlockOp){
    let tarUId = tarBlockOp.UId;
    let refUId = refBlockOp.UId;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    // 目標包住參考 目標操作則不改變
    if(contain(tarParentId,tarIndex,refParentId,refIndex)) return tarBlockOp;
    // 參考包住目標 目標操作直接不執行
    else if(contain(refParentId,refIndex, tarParentId,tarIndex)){
        let xFormedOp = new Op(tarUId, 'null', tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }
    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作 (因為目標包含參考不需要改變，所以不多寫出來)
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //若在以下條件: 目標index大於參考index =>則將目標index-1
    else if(tarIndex > refIndex){
        let xFormedOp = new Op(tarUId, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
    //其他:index相等,不回傳重複操作
    else{
        let xFormedOp = new Op(tarUId, 'null', tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }
}

function TEF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}

function TEE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
usernameForm.addEventListener('submit', connect, true)
//messageForm.addEventListener('submit', send, true)
opForm.addEventListener('submit', send, true)