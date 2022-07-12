package com.tupinamba.springbootwebsocket.model;

public class UserObj {

    private String userObjEmail;
    private String userObjName;
    private String userObjAvatar;

    public UserObj(String email, String name, String avatar){
        this.userObjEmail = email;
        this.userObjName = name;
        this.userObjAvatar = avatar;
    }

    public String getUserObjAvatar() {
        return userObjAvatar;
    }

    public String getUserObjEmail() {
        return userObjEmail;
    }

    public String getUserObjName() {
        return userObjName;
    }

    public void setUserObjAvatar(String userObjAvatar) {
        this.userObjAvatar = userObjAvatar;
    }

    public void setUserObjEmail(String userObjEmail) {
        this.userObjEmail = userObjEmail;
    }

    public void setUserObjName(String userObjName) {
        this.userObjName = userObjName;
    }
}
