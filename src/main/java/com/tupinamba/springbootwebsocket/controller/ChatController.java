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
    int localTs=0;
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
    public void sendMessage(@Header("simpSessionId") String sessionId, @Payload ChatMessage chatMessage) throws InterruptedException {
        String sender = chatMessage.getSender();
        System.out.println(chatMessage.getContent());
        int remoteTs=chatMessage.getRemoteTS();
        // skip the OP
        Thread.sleep(3000);
        if(remoteTs < localTs) return;
        // handle this OP
        else{
            if(controllerState == ControllerState.LISTENING){
                // start handle this OP
                controllerState = ControllerState.PROCESSING;
                // save this OP
                localTs+=1;
                System.out.println(localTs);
                chatMessage.setRemoteTS(localTs);
                for (Map.Entry<String, String> entry : dict.entrySet()) {
                    if( !sender.equals(entry.getKey()) ){
                        simpMessagingTemplate.convertAndSendToUser(entry.getValue(), "/msg", chatMessage);
                    }
                }
                chatMessage.setContent("Ack");
                chatMessage.setSender("Controller");
                simpMessagingTemplate.convertAndSendToUser(sessionId, "/msg", chatMessage);
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