package com.tupinamba.springbootwebsocket.controller;

import com.tupinamba.springbootwebsocket.model.ChatMessage;
import com.tupinamba.springbootwebsocket.model.Op;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

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
        ChatMessage.MessageType type=CtoS_msg.getType();
        if(type== ChatMessage.MessageType.LEAVE ){
            System.out.println(type);
            System.out.println(dict.size());
            dict.remove(sender);
            System.out.println(dict.size());
            if(dict.size()==0){
                localTS=0;
                opHistory.clear();
            }
        }
        int remoteTS = CtoS_msg.getTS();
        Op remoteOp = CtoS_msg.getOp();
        // skip the OP
         System.out.println("remoteTS: " + remoteTS + ",  localTS: " + localTS);
        if(remoteTS <= localTS){
            // System.out.println("keep listening!!");
            return;
        }
        // handle this OP
        else{
            if(controllerState == ControllerState.LISTENING){
                // start handle this OP
                System.out.println("converting");
                controllerState = ControllerState.PROCESSING;
                try{
                    Thread.sleep(3000);
                }
                catch (InterruptedException e){}

                /***** PersistingNew *****/
                // step 1: set localTS to the value from the received CtoS Msg event
                localTS = remoteTS;
                // step 2: persist the Op as part of the official document history
                opHistory.add(remoteOp);

                /***** SendingACKToClient *****/
                // step 1: send StoC ACK event to the clientID of the accepted Op
                CtoS_msg.setType(ChatMessage.MessageType.ACK);
                CtoS_msg.setSender("Controller");
                simpMessagingTemplate.convertAndSendToUser(sender, "/msg", CtoS_msg);

                /***** SendingToRemainingClients *****/
                CtoS_msg.setType(ChatMessage.MessageType.OP);
                CtoS_msg.setTS(localTS);
                CtoS_msg.setSender(sender);
                for (Map.Entry<String, String> entry : dict.entrySet()) {
                    if( !sender.equals(entry.getKey()) ){
                        simpMessagingTemplate.convertAndSendToUser(entry.getKey(), "/msg", CtoS_msg);
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
        //dealMsg(sessionId, CtoS_msg);
    }

    synchronized public void dealMsg(String sessionId, ChatMessage CtoS_msg){

    }
    @EventListener
    private void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sender = event.getSessionId();
            System.out.println(dict.size());
            dict.values().remove(sender);
            System.out.println(dict.size());
            if(dict.size()==0){
                localTS=0;
                opHistory.clear();
            }

    }

}