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
        for (Map.Entry<String, String> entry : dict.entrySet()) {
            if( !sender.equals(entry.getKey()) ){
                simpMessagingTemplate.convertAndSendToUser(entry.getValue(), "/msg", chatMessage);
            }
        }
        chatMessage.setSender("Me");
        simpMessagingTemplate.convertAndSendToUser(sessionId, "/msg", chatMessage);
    }

}