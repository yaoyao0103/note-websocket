package com.tupinamba.springbootwebsocket.controller;

import com.tupinamba.springbootwebsocket.model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;

@Controller
public class ChatController {

    Map<String, String> dict = new HashMap<>();
    ControllerState controllerState = ControllerState.LISTENING;

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    @MessageMapping("/chat.register")
    @SendTo("/topic/public")
    public ChatMessage register(@Header("simpSessionId") String sessionId, @Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        String sender = chatMessage.getSender();
        headerAccessor.getSessionAttributes().put("username", sender);
        //System.out.println(headerAccessor);
        dict.put(sender, sessionId);
        System.out.println(dict);
        chatMessage.setSessionId(sessionId);
        return chatMessage;
    }


    @MessageMapping("/chat.send")
    public void sendMessage(@Header("simpSessionId") String sessionId, @Payload ChatMessage chatMessage) {
        String sender = chatMessage.getSender();

        /*
        // skip the OP
        if(remoteTs <= localTs) return;
        // handle this OP
        else{
            if(controllerState == ControllerState.LISTENING){
                // start handle this OP
                controllerState = ControllerState.PROCESSING;
                // save this OP
                saveOp(op);

                //respond ACK msg to the client
                simpMessagingTemplate.convertAndSendToUser(sessionId, "/msg", ACK);

                // send the OP to the other clients
                for (Map.Entry<String, String> entry : dict.entrySet()) {
                    if( !sender.equals(entry.getKey()) ){
                        simpMessagingTemplate.convertAndSendToUser(entry.getValue(), "/msg", op);
                    }
                }
                localTs += 1;
                //finish
                controllerState = ControllerState.LISTENING;
             }
             // do nothing
             else{
               return;
             }
        }
        */


        for (Map.Entry<String, String> entry : dict.entrySet()) {
            if( !sender.equals(entry.getKey()) ){
                simpMessagingTemplate.convertAndSendToUser(entry.getValue(), "/msg", chatMessage);
            }
        }
        chatMessage.setSender("Me");
        simpMessagingTemplate.convertAndSendToUser(sessionId, "/msg", chatMessage);
    }

}