package com.tupinamba.springbootwebsocket.controller;

import com.tupinamba.springbootwebsocket.model.ChatMessage;
import com.tupinamba.springbootwebsocket.model.Op;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class ChatController {

    Map<String, String> dict = new HashMap<>();
    ControllerState controllerState = ControllerState.LISTENING;
    int localTS = 0;
    List<Op> opHistory = new ArrayList<Op>();
    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    @MessageMapping("/chat.register")
    @SendTo("/topic/public")
    public ChatMessage register(@Header("simpSessionId") String sessionId, @Payload ChatMessage CtoS_msg, SimpMessageHeaderAccessor headerAccessor) {
        String sender = CtoS_msg.getSender();
        headerAccessor.getSessionAttributes().put("username", sender);
        //System.out.println(headerAccessor);
        dict.put(sender, sessionId);
        System.out.println(dict);

        CtoS_msg.setSessionId(sessionId);
        return CtoS_msg;
    }


    @MessageMapping("/chat.send")
    public void sendMessage(@Header("simpSessionId") String sessionId, @Payload ChatMessage CtoS_msg) throws InterruptedException {
        System.out.println(controllerState);
        String sender = CtoS_msg.getSender();
        int remoteTS = CtoS_msg.getTS();
        //System.out.println(remoteTS);
        Op remoteOp = CtoS_msg.getOp();
        // skip the OP
        //System.out.println(remoteTS + " " + localTS);
        if(remoteTS <= localTS) return;
        // handle this OP
        else{
            if(controllerState == ControllerState.LISTENING){
                // start handle this OP
                controllerState = ControllerState.PROCESSING;
                Thread.sleep(3000);
                /***** PersistingNew *****/
                // step 1: set localTS to the value from the received CtoS Msg event
                localTS = remoteTS;
                // step 2: persist the Op as part of the official document history
                opHistory.add(remoteOp);

                /***** SendingACKToClient *****/
                // step 1: send StoC ACK event to the clientID of the accepted Op
                CtoS_msg.setType(ChatMessage.MessageType.ACK);
                CtoS_msg.setSender("Controller");
                simpMessagingTemplate.convertAndSendToUser(sessionId, "/msg", CtoS_msg);

                /***** SendingToRemainingClients *****/
                CtoS_msg.setType(ChatMessage.MessageType.OP);
                CtoS_msg.setTS(localTS);
                CtoS_msg.setSender(sender);
                for (Map.Entry<String, String> entry : dict.entrySet()) {
                    if( !sender.equals(entry.getKey()) ){
                        simpMessagingTemplate.convertAndSendToUser(entry.getValue(), "/msg", CtoS_msg);
                    }
                }

                //finish
                controllerState = ControllerState.LISTENING;
             }
             // do nothing
             else{
               return;
             }
        }
    }

}