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

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];
var localTS=0;
var remoteTS=0;
var B_op= null;
var B_parent= null;
var B_index= null;
var B_content= null;
var tempContent=null;
class Op {
    constructor(UId, opName, parentId, index, content){
        this.UId = UId;
        this.opName = opName;
        this.parentId = parentId;
        this.index = index;
        this.content = content;
    }
}
const ClientStateenum = {"synced":1, "AwaitingACK":2, "AwaitingWithBuffer":3}
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
    ClientState=ClientStateenum.synced;
}


function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket! Please refresh the page and try again or contact your administrator.';
    connectingElement.style.color = 'red';
}


function send(event) {
    let A_op = document.getElementById("A_op").value;
    let A_parent = document.getElementById("A_parent").value;
    let A_index = parseInt(document.getElementById("A_index").value);
    let A_content = document.getElementById("A_content").value;
    let blockOpA = new Op(1, A_op, A_parent, A_index, A_content);
    let newNodeA;
    let newTextNodeA;
    let nodeOfClientA;
    let children;

    if (blockOpA.opName === 'INSERT') {
        //create new node
        newNodeA = document.createElement('div');
        newTextNodeA = document.createTextNode(A_content);
        newNodeA.appendChild(newTextNodeA);
        //apply locally
        nodeOfClientA = document.getElementById('A_' + A_parent);
        children = nodeOfClientA.children;
        nodeOfClientA.insertBefore(newNodeA, children[A_index]);
    } else if (blockOpA.opName === 'DELETE') {
        //save origin content
        tempContent=A_content;
        nodeOfClientA = document.getElementById('A_' + A_parent);
        children = nodeOfClientA.children;
        nodeOfClientA.removeChild(children[A_index]);

    } else if (blockOpA.opName === 'EDIT'){
        //save origin content
        tempContent=A_content;
        nodeOfClientA = document.getElementById('A_' + A_parent);
        children = nodeOfClientA.children;
        children[A_index].innerHTML = A_content;
    }


    if(ClientState==ClientStateenum.synced) {

        var messageContent = messageInput.value.trim();
        var opName = document.getElementById("A_op");
        var index = document.getElementById("A_index");
        var parentId = document.getElementById("A_parent");
        var content = document.getElementById("A_content");

        if (stompClient) {
            console.log('111');
            var chatMessage = {
                sender: username,
                opName: opName.value,
                index: index.value,
                content: content.value,
                remoteTS: localTS,
                parentId: parentId.value,
                type: 'CHAT'
            };

            stompClient.send("/app/chat.send", {}, JSON.stringify(chatMessage));
            messageInput.value = '';
        }
        ClientState = ClientStateenum.AwaitingACK;
        event.preventDefault();

    }
}


function onMessageReceived(payload) {

    var message = JSON.parse(payload.body);

    var messageElement = document.createElement('li');

    if(message.type === 'JOIN') {
        if(message.sender === username){
            sessionId = message.sessionId;
            stompClient.subscribe('/user/' + sessionId + '/msg', onMessageReceived);
        }
        messageElement.classList.add('event-message');
        message.content = message.sender + ' joined!';
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' left!';
    } else {
        if (ClientState==ClientStateenum.synced){
            let A_op = message.opName;
            let A_parent= message.parentId;
            let A_index = message.index;
            let A_content = message.content;
            console.log(A_index);
            let blockOpA = new Op(1, A_op, A_parent, A_index, A_content);
            let newNodeA;
            let newTextNodeA;
            let nodeOfClientA;
            let children;
            if(blockOpA.opName === 'INSERT'){
                //create new node
                newNodeA = document.createElement('div');
                newTextNodeA = document.createTextNode(A_content);
                newNodeA.appendChild(newTextNodeA);
                //apply locally
                nodeOfClientA = document.getElementById('A_' + A_parent);
                children = nodeOfClientA.children;
                nodeOfClientA.insertBefore(newNodeA, children[A_index]);
            }
            else if(blockOpA.opName === 'DELETE'){
                nodeOfClientA = document.getElementById('A_' + A_parent);
                children = nodeOfClientA.children;
                nodeOfClientA.removeChild(children[A_index]);
            }
            else if(blockOpA.opName === 'EDIT'){
                nodeOfClientA = document.getElementById('A_' + A_parent);
                children = nodeOfClientA.children;
                children[A_index].innerHTML = A_content;
            }
            localTS=message.remoteTS;
            ClientState = ClientStateenum.synced;
        }
        else if(ClientState==ClientStateenum.AwaitingACK){
            //Client waiting for ack & Controller send back ack
            if(message.content==='Ack') {
                localTS = message.remoteTS;
                ClientState = ClientStateenum.synced;
            }
            else { //Client waiting for ack & Controller send other client's operation
                B_op = message.opName;
                B_parent = message.parentId;
                B_index = message.index;
                B_content = message.content;
                let A_op = document.getElementById("A_op").value;
                let A_parent = document.getElementById("A_parent").value;
                let A_index = parseInt(document.getElementById("A_index").value);
                let A_content = document.getElementById("A_content").value;
                let blockOpA = new Op(1, A_op, A_parent, A_index, A_content);
                let blockOpB = new Op(1, B_op, B_parent, B_index, B_content);
                let newNodeA;
                let newTextNodeA;
                let nodeOfClientA;
                let newNodeB;
                let newTextNodeB;
                let nodeOfClientB;
                let children;
                let xFormedOpA; // A'
                let xFormedOpB; // B'
                //Recover origin content
                // if(blockOpA.opName === 'INSERT'){
                //     //Delete operation back
                //     nodeOfClientA = document.getElementById('A_' + A_parent);
                //     children = nodeOfClientA.children;
                //     nodeOfClientA.removeChild(children[A_index]);
                // }
                // else if(blockOpA.opName === 'DELETE'){
                //     //Insert operation back
                //     //create new node
                //     newNodeA = document.createElement('div');
                //     newTextNodeA = document.createTextNode(tempContent);
                //     newNodeA.appendChild(newTextNodeA);
                //     //apply locally
                //     nodeOfClientA = document.getElementById('A_' + A_parent);
                //     children = nodeOfClientA.children;
                //     nodeOfClientA.insertBefore(newNodeA, children[A_index]);
                // }
                // else if(blockOpA.opName === 'EDIT'){
                //     nodeOfClientA = document.getElementById('A_' + A_parent);
                //     children = nodeOfClientA.children;
                //     children[A_index].innerHTML = tempContent;
                // }
                //Operation Transformation
                if(A_op === 'INSERT'){
                    if(B_op === 'INSERT'){
                        xFormedOpA = TII(blockOpA, blockOpB); // get A'
                        xFormedOpB = TII(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'DELETE'){
                        xFormedOpA = TID(blockOpA, blockOpB); // get A'
                        xFormedOpB = TDI(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'EDIT'){
                        xFormedOpA = TIE(blockOpA, blockOpB); // get A'
                        xFormedOpB = TEI(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'FOCUS'){
                        xFormedOpA = TIF(blockOpA, blockOpB); // get A'
                        xFormedOpB = TFI(blockOpB, blockOpA); // get B'
                    }
                }
                else if(A_op === 'DELETE'){
                    if(B_op === 'INSERT'){
                        xFormedOpA = TDI(blockOpA, blockOpB); // get A'
                        xFormedOpB = TID(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'DELETE'){
                        xFormedOpA = TDD(blockOpA, blockOpB); // get A'
                        xFormedOpB = TDD(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'EDIT'){
                        xFormedOpA = TDE(blockOpA, blockOpB); // get A'
                        xFormedOpB = TED(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'FOCUS'){
                        xFormedOpA = TDF(blockOpA, blockOpB); // get A'
                        xFormedOpB = TFD(blockOpB, blockOpA); // get B'
                    }
                }
                else if(A_op === 'EDIT'){
                    if(B_op === 'INSERT'){
                        xFormedOpA = TEI(blockOpA, blockOpB); // get A'
                        xFormedOpB = TIE(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'DELETE'){
                        xFormedOpA = TED(blockOpA, blockOpB); // get A'
                        xFormedOpB = TDE(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'EDIT'){
                        xFormedOpA = TEE(blockOpA, blockOpB); // get A'
                        xFormedOpB = TEE(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'FOCUS'){
                        xFormedOpA = TEF(blockOpA, blockOpB); // get A'
                        xFormedOpB = TFE(blockOpB, blockOpA); // get B'
                    }
                }
                else if(A_op === 'FOCUS'){
                    if(B_op === 'INSERT'){
                        xFormedOpA = TFI(blockOpA, blockOpB); // get A'
                        xFormedOpB = TIF(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'DELETE'){
                        xFormedOpA = TFD(blockOpA, blockOpB); // get A'
                        xFormedOpB = TDF(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'EDIT'){
                        xFormedOpA = TFE(blockOpA, blockOpB); // get A'
                        xFormedOpB = TEF(blockOpB, blockOpA); // get B'
                    }
                    else if(B_op === 'FOCUS'){
                        xFormedOpA = TFF(blockOpA, blockOpB); // get A'
                        xFormedOpB = TFF(blockOpB, blockOpA); // get B'
                    }
                }
                //This test version doesn't change local before receive ack
                if(xFormedOpB.opName === 'INSERT'){
                    //create new node
                    newNodeB = document.createElement('div');
                    newTextNodeB = document.createTextNode(B_content);
                    newNodeB.appendChild(newTextNodeB);
                    //apply locally
                    nodeOfClientB = document.getElementById('A_' + B_parent);
                    children = nodeOfClientB.children;
                    nodeOfClientB.insertBefore(newNodeB, children[B_index]);
                }
                else if(xFormedOpB.opName === 'DELETE'){
                    nodeOfClientB = document.getElementById('A_' + B_parent);
                    children = nodeOfClientB.children;
                    nodeOfClientB.removeChild(children[B_index]);
                }
                else if(xFormedOpB.opName === 'EDIT'){
                    nodeOfClientB = document.getElementById('A_' + B_parent);
                    children = nodeOfClientB.children;
                    children[B_index].innerHTML = B_content;
                }
                //set new localTS after accept other operations
                localTS=message.remoteTS;
                //Sending new message after OT
                if (stompClient) {
                    console.log('111');
                    var chatMessage = {
                        sender: username,
                        opName: xFormedOpA.opName,
                        index: xFormedOpA.index,
                        content: xFormedOpA.content,
                        remoteTS: localTS,
                        parentId: xFormedOpA.parentId,
                        type: 'CHAT'
                    };

                    stompClient.send("/app/chat.send", {}, JSON.stringify(chatMessage));
                    messageInput.value = '';
                }
                ClientState = ClientStateenum.AwaitingACK;
            }
        }

        messageElement.classList.add('chat-message');

        var avatarElement = document.createElement('i');
        var avatarText = document.createTextNode(message.sender[0]);
        avatarElement.appendChild(avatarText);
        avatarElement.style['background-color'] = getAvatarColor(message.sender);

        messageElement.appendChild(avatarElement);

        var usernameElement = document.createElement('span');
        var usernameText = document.createTextNode(message.sender);
        usernameElement.appendChild(usernameText);
        messageElement.appendChild(usernameElement);

    }

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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
    let tarOp = tarBlockOp.opName;
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