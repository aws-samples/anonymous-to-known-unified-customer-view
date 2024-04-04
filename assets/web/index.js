$(document).ready(function () {
  function bindUserIntercations() {
    switch ($("#interactionSelect").val()) {
      case "view_product":
        $("#interactionContainer").html(
          '<input required type="text" class="form-control" style="width: 300px;" id="productid" placeholder="Product Id">'
        );
        break;
      case "add_to_cart":
        $("#interactionContainer").html(
          '<input required type="text" class="form-control" style="width: 500px;" id="productid" placeholder="Product Ids semicolon separated values">'
        );
        break;
      case "register":
        $("#interactionContainer").html(
          '<input required type="text" class="form-control" style="width: 500px;" id="email" placeholder="User Email">'
        );
        break;
      case "sign_in":
        $("#interactionContainer").html(
          '<input required type="text" class="form-control" style="width: 500px;" id="email" placeholder="User Email">'
        );
        break;
      case "place_order":
        $("#interactionContainer").html(
          '<input required type="text" class="form-control" style="width: 500px;" id="email" placeholder="User Email"> <br> <input type="text" class="form-control" style="width: 500px;" id="productid" placeholder="Product Ids semicolon separated values"> <br> <input type="number" class="form-control" style="width: 500px;" id="orderTotal" placeholder="Order Value Numeric">'
        );
        break;
      default:
      // code block
    }
  }
  bindUserIntercations();
  $("#interactionSelect").on("change", bindUserIntercations);

  function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }

  function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  function performAction(stepName) {
    switch (stepName) {
      case "step1":
        localStorage.setItem(
          "apigateway",
          $("#amazonapigatewayendpoint").val()
        );
        localStorage.setItem("streamname", $("#amazonKinesisStreamName").val());
        $("#alert").show();
        setTimeout(function () {
          $("#alert").hide();
          console.log("done");
        }, 5000);
        break;
      case "step2":
        var post_body = {
          Data: {
            event_id: uuidv4(),
            fp_cookie_id: getCookie("fp_cookie_id"),
            event_name: $("#interactionSelect").val(),
            product_id:
              $("#productid").val() === undefined
                ? null
                : $("#productid").val(),
            email: $("#email").val() === undefined ? null : $("#email").val(),
            order_value:
              $("#orderTotal").val() === undefined
                ? null
                : $("#orderTotal").val(),
          },
        };
        $.ajax({
          url:
            localStorage.getItem("apigateway") +
            "/user-interaction?stream-name=" +
            localStorage.getItem("streamname"),
          type: "POST",
          data: JSON.stringify(post_body),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          success: function (data, status) {
            $("#alert").show();
            setTimeout(function () {
              $("#alert").hide();
              console.log("done");
            }, 5000);
          },
        });
        break;
      case "step3":
        $.get(
          localStorage.getItem("apigateway") +
            "/profile?email=" +
            $("#userEmail").val(),
          function (data, status) {
            $("#eventsTable > tbody").html("");
            $("#identifiersList").html("");
            $.each(data.Response.Items, function (key, value) {
              var row = $(
                "<tr><td>" +
                  value.event_id +
                  "</td><td>" +
                  value.event_name +
                  "</td><td>" +
                  value.MatchID +
                  "</td><td>" +
                  value.fp_cookie_id +
                  "</td><td>" +
                  value.email +
                  "</td><td>" +
                  value.product_id +
                  "</td><td>" +
                  value.order_value +
                  "</td></tr>"
              );
              $("#eventsTable > tbody").append(row);
            });
            const fp_cookie_id_propertyValues = data.Response.Items.map(
              (obj) => obj["fp_cookie_id"]
            );
            const fp_cookie_id_uniqueValuesSet = new Set(
              fp_cookie_id_propertyValues
            );
            const fp_cookie_id_distinctValues = Array.from(
              fp_cookie_id_uniqueValuesSet
            );
            const email_propertyValues = data.Response.Items.map(
              (obj) => obj["email"]
            );
            const email_uniqueValuesSet = new Set(email_propertyValues);
            const email_distinctValues = Array.from(email_uniqueValuesSet);
            fp_cookie_id_distinctValues.forEach(function (item) {
              if (item != null)
                $("#identifiersList").append(
                  "<li class='list-group-item'>1st Party Cookie: " +
                    item +
                    "</li>"
                );
            });
            email_distinctValues.forEach(function (item) {
              if (item != null)
                $("#identifiersList").append(
                  "<li class='list-group-item'>Email: " + item + "</li>"
                );
            });

            $("#myModal").modal("show");
          }
        );
        break;
    }
  }

  function formSubmit(stepName, validationClass) {
    var forms = document.querySelectorAll(validationClass);

    Array.prototype.slice.call(forms).forEach(function (form) {
      form.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
          event.stopPropagation();
          form.classList.add("was-validated");
          if (form.checkValidity()) {
            performAction(stepName);
          }
        },
        false
      );
    });
  }

  formSubmit("step1", ".step1-validation");
  formSubmit("step2", ".step2-validation");
  formSubmit("step3", ".step3-validation");

  function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  }

  if (getCookie("fp_cookie_id") == "") {
    setCookie("fp_cookie_id", uuidv4(), 365);
  }
  $("#amazonapigatewayendpoint").val(localStorage.getItem("apigateway"));
  $("#amazonKinesisStreamName").val(localStorage.getItem("streamname"));

  function getUserProfileByfpCookie() {
    $.get(
      localStorage.getItem("apigateway") +
        "/profile?fp_cookie_id=" +
        getCookie("fp_cookie_id"),
      function (data, status) {
        $("#eventsTable > tbody").html("");
        $("#identifiersList").html("");
        $.each(data.Response.Items, function (key, value) {
          var row = $(
            "<tr><td>" +
              value.event_id +
              "</td><td>" +
              value.event_name +
              "</td><td>" +
              value.MatchID +
              "</td><td>" +
              value.fp_cookie_id +
              "</td><td>" +
              value.email +
              "</td><td>" +
              value.product_id +
              "</td><td>" +
              value.order_value +
              "</td></tr>"
          );
          $("#eventsTable > tbody").append(row);
        });
        const fp_cookie_id_propertyValues = data.Response.Items.map(
          (obj) => obj["fp_cookie_id"]
        );
        const fp_cookie_id_uniqueValuesSet = new Set(
          fp_cookie_id_propertyValues
        );
        const fp_cookie_id_distinctValues = Array.from(
          fp_cookie_id_uniqueValuesSet
        );
        const email_propertyValues = data.Response.Items.map(
          (obj) => obj["email"]
        );
        const email_uniqueValuesSet = new Set(email_propertyValues);
        const email_distinctValues = Array.from(email_uniqueValuesSet);
        fp_cookie_id_distinctValues.forEach(function (item) {
          if (item != null)
            $("#identifiersList").append(
              "<li class='list-group-item'>1st Party Cookie: " + item + "</li>"
            );
        });
        email_distinctValues.forEach(function (item) {
          if (item != null)
            $("#identifiersList").append(
              "<li class='list-group-item'>Email: " + item + "</li>"
            );
        });

        $("#myModal").modal("show");
      }
    );
  }

  $("#btnGetProfilebyfpCookie").click(function () {
    getUserProfileByfpCookie();
  });
});
