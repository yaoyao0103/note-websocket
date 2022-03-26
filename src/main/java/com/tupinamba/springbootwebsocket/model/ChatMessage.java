package com.tupinamba.springbootwebsocket.model;


public class ChatMessage {

    private String sender;
    private String sessionId;
    private MessageType type;
    private int ts;
    private Op op;

    public enum MessageType {
        OP, LEAVE, JOIN, ACK
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public Op getOp() {
        return op;
    }

    public void setOp(Op op) {
        this.op = op;
    }

    public int getTS() {
        return ts;
    }

    public void setTS(int ts) {
        this.ts = ts;
    }

    @Override
    public String toString(){
        return String.format("sender: %s,  TS: %d", sender, ts);
    }
}
